import { type NextRequest } from "next/server";
import { LessonType, UserRole } from "@prisma/client";
import { ZodError } from "zod";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { verifyCourseOwner } from "@/lib/auth/check-ownership";
import { verifyEnrollment } from "@/lib/auth/check-enrollment";
import { requireRole } from "@/lib/auth/require-role";
import { getLessonById } from "@/lib/services/lesson.service";
import {
  createQuiz,
  deleteQuiz,
  getQuizByLessonId,
  QuizServiceError,
  updateQuiz,
} from "@/lib/services/quiz.service";
import { quizCreateSchema, quizUpdateSchema } from "@/lib/validations/quiz";
import {
  badRequest,
  conflict,
  created,
  forbidden,
  noContent,
  notFound,
  ok,
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

function assertQuizLesson(lessonType: LessonType) {
  if (lessonType !== LessonType.QUIZ) {
    throw new QuizServiceError("This lesson is not configured as a quiz lesson.", 400);
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { lessonId } = await context.params;
    const caller = await getAuthUser(request);
    const lesson = await getLessonById(lessonId);

    const allowed = await verifyEnrollment(caller, lesson.module.courseId);
    if (!allowed) {
      return forbidden("You do not have access to this quiz.");
    }

    assertQuizLesson(lesson.lessonType);

    const quiz = await getQuizByLessonId(lessonId, caller.role);
    return ok(quiz);
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    if (err instanceof QuizServiceError) {
      return quizError(err);
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[GET /api/lessons/:lessonId/quiz]", err);
    return serverError();
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { lessonId } = await context.params;
    const caller = await getAuthUser(request);

    requireRole(caller, [UserRole.TEACHER, UserRole.ADMIN]);

    const lesson = await getLessonById(lessonId);
    await verifyCourseOwner(caller, lesson.module.courseId);
    assertQuizLesson(lesson.lessonType);

    const body = await request.json().catch(() => null);
    if (!body) {
      return badRequest("Request body must be valid JSON.");
    }

    const parsed = quizCreateSchema.parse(body);
    const quiz = await createQuiz(lessonId, parsed);

    return created(quiz, "Quiz created successfully.");
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
    console.error("[POST /api/lessons/:lessonId/quiz]", err);
    return serverError();
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { lessonId } = await context.params;
    const caller = await getAuthUser(request);

    requireRole(caller, [UserRole.TEACHER, UserRole.ADMIN]);

    const lesson = await getLessonById(lessonId);
    await verifyCourseOwner(caller, lesson.module.courseId);
    assertQuizLesson(lesson.lessonType);

    const body = await request.json().catch(() => null);
    if (!body) {
      return badRequest("Request body must be valid JSON.");
    }

    const parsed = quizUpdateSchema.parse(body);
    if (Object.keys(parsed).length === 0) {
      return badRequest("Request body must contain at least one field to update.");
    }

    const quiz = await getQuizByLessonId(lessonId, UserRole.TEACHER);
    const updated = await updateQuiz(quiz.id, parsed);

    return ok(updated, "Quiz updated successfully.");
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
    console.error("[PATCH /api/lessons/:lessonId/quiz]", err);
    return serverError();
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { lessonId } = await context.params;
    const caller = await getAuthUser(request);

    requireRole(caller, [UserRole.TEACHER, UserRole.ADMIN]);

    const lesson = await getLessonById(lessonId);
    await verifyCourseOwner(caller, lesson.module.courseId);
    assertQuizLesson(lesson.lessonType);

    const quiz = await getQuizByLessonId(lessonId, UserRole.TEACHER);
    await deleteQuiz(quiz.id);

    return noContent();
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    if (err instanceof QuizServiceError) {
      return quizError(err);
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[DELETE /api/lessons/:lessonId/quiz]", err);
    return serverError();
  }
}
