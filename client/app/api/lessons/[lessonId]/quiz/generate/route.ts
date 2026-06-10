import { type NextRequest } from "next/server";
import { LessonType, UserRole } from "@prisma/client";
import { ZodError, z } from "zod";
import { AuthError, getAuthUser } from "@/lib/auth/get-auth-user";
import { verifyCourseOwner } from "@/lib/auth/check-ownership";
import { requireRole } from "@/lib/auth/require-role";
import { error as apiError, badRequest, forbidden, notFound, ok, serverError, unauthorized } from "@/lib/api-response";
import { getLessonById } from "@/lib/services/lesson.service";
import { geminiService } from "@/lib/gemini/gemini.service";
import { quizQuestionsSchema } from "@/lib/validations/quiz";

type RouteContext = { params: Promise<{ lessonId: string }> };

const generateQuizSchema = z
  .object({
    numberOfQuestions: z
      .number({ error: "numberOfQuestions must be a number." })
      .int("numberOfQuestions must be an integer.")
      .min(1, "numberOfQuestions must be at least 1.")
      .max(20, "numberOfQuestions must be at most 20.")
      .optional(),
  })
  .strict();

function zodIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}

function isRateLimitError(error: unknown) {
  if (error instanceof Error && error.message.includes("429")) return true;
  if (typeof error !== "object" || error === null) return false;

  const maybeStatus = (error as { status?: unknown }).status;
  const maybeCode = (error as { code?: unknown }).code;

  return maybeStatus === 429 || maybeCode === 429;
}

function parseJsonArray(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      throw new Error("Gemini did not return valid JSON.");
    }
    return JSON.parse(match[0]);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { lessonId } = await context.params;
    const caller = await getAuthUser(request);

    requireRole(caller, [UserRole.TEACHER, UserRole.ADMIN]);

    const body = await request.json().catch(() => ({}));
    const parsedBody = generateQuizSchema.parse(body ?? {});
    const numberOfQuestions = parsedBody.numberOfQuestions ?? 5;

    const lesson = await getLessonById(lessonId);
    const course = await verifyCourseOwner(caller, lesson.module.courseId);

    if (lesson.lessonType !== LessonType.QUIZ) {
      return badRequest("This lesson is not configured as a quiz lesson.");
    }

    if (!course.aiEnabled) {
      return badRequest(
        "AI Tutor is disabled for this course. Enable and sync course materials before generating quiz questions.",
      );
    }

    const lessonContent = lesson.content?.trim() ?? "";
    const fileUris = lesson.materials
      .map((material) => material.geminiFileUri)
      .filter((uri): uri is string => Boolean(uri));
    const hasLessonText = lessonContent.length > 0;
    const hasSyncedGeminiFiles = fileUris.length > 0;

    if (!hasLessonText && !hasSyncedGeminiFiles) {
      return badRequest(
        "No lesson content or synced Gemini materials found. Add lesson content or sync materials before generating questions.",
      );
    }

    const promptContent = hasLessonText
      ? lessonContent
      : "Please act as an expert teacher and generate a quiz strictly based on the attached document(s).";

    const responseText = await geminiService.generateQuizQuestions({
      lessonTitle: lesson.title,
      lessonContent: promptContent,
      fileUris,
      numberOfQuestions,
    });

    const generated = parseJsonArray(responseText);
    const questions = quizQuestionsSchema.parse(generated);

    return ok(questions, "Quiz questions generated successfully.");
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }

    if (err instanceof ZodError) {
      return badRequest("Validation failed.", zodIssues(err));
    }

    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }

    if (isRateLimitError(err)) {
      return apiError("Gemini rate limit reached. Please try again in a moment.", 429);
    }

    console.error("[POST /api/lessons/:lessonId/quiz/generate]", err);
    return serverError("Failed to generate quiz questions.");
  }
}
