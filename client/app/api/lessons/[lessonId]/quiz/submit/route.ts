import { type NextRequest } from "next/server";
import { LessonType, UserRole } from "@prisma/client";
import { ZodError } from "zod";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { verifyEnrollment } from "@/lib/auth/check-enrollment";
import { requireRole } from "@/lib/auth/require-role";
import { getLessonById } from "@/lib/services/lesson.service";
import {
  getQuizByLessonId,
  QuizServiceError,
  submitAttempt,
} from "@/lib/services/quiz.service";
import { quizSubmitSchema } from "@/lib/validations/quiz";
import {
  badRequest,
  conflict,
  created,
  forbidden,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/api-response";

type RouteContext = { params: Promise<{ lessonId: string }> };

function zodIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}

function quizError(error: QuizServiceError) {
  if (error.status === 403) return forbidden(error.message);
  if (error.status === 404) return notFound(error.message);
  if (error.status === 409) return conflict(error.message);
  return badRequest(error.message);
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { lessonId } = await context.params;
    const caller = await getAuthUser(request);

    requireRole(caller, [UserRole.STUDENT]);

    const lesson = await getLessonById(lessonId);
    if (lesson.lessonType !== LessonType.QUIZ) {
      return badRequest("This lesson is not configured as a quiz lesson.");
    }

    const isEnrolled = await verifyEnrollment(caller, lesson.module.courseId);
    if (!isEnrolled) {
      return forbidden("You must be enrolled in this course to submit the quiz.");
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return badRequest("Request body must be valid JSON.");
    }

    const parsed = quizSubmitSchema.parse(body);
    const quiz = await getQuizByLessonId(lessonId, caller.role);
    const attempt = await submitAttempt(quiz.id, caller.id, parsed.answers);

    return created(attempt, "Quiz submitted successfully.");
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    if (err instanceof ZodError) {
      return badRequest("Validation failed.", zodIssues(err));
    }
    if (err instanceof QuizServiceError) {
      return quizError(err);
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[POST /api/lessons/:lessonId/quiz/submit]", err);
    return serverError();
  }
}
