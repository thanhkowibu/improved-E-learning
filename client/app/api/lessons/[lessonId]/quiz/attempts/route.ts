import { type NextRequest } from "next/server";
import { LessonType, UserRole } from "@prisma/client";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { verifyCourseOwner } from "@/lib/auth/check-ownership";
import { verifyEnrollment } from "@/lib/auth/check-enrollment";
import { getLessonById } from "@/lib/services/lesson.service";
import {
  getAttempts,
  getQuizByLessonId,
  getQuizSubmissionsForTeacher,
  QuizServiceError,
} from "@/lib/services/quiz.service";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "@/lib/api-response";

type RouteContext = { params: Promise<{ lessonId: string }> };

function quizError(error: QuizServiceError) {
  if (error.status === 403) return forbidden(error.message);
  if (error.status === 404) return notFound(error.message);
  if (error.status === 409) return conflict(error.message);
  return badRequest(error.message);
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { lessonId } = await context.params;
    const caller = await getAuthUser(request);
    const lesson = await getLessonById(lessonId);

    if (lesson.lessonType !== LessonType.QUIZ) {
      return badRequest("This lesson is not configured as a quiz lesson.");
    }

    const quiz = await getQuizByLessonId(lessonId, UserRole.TEACHER);

    if (caller.role === UserRole.STUDENT) {
      const isEnrolled = await verifyEnrollment(caller, lesson.module.courseId);
      if (!isEnrolled) {
        return forbidden("You must be enrolled in this course to view quiz attempts.");
      }

      const attempts = await getAttempts(quiz.id, caller.id);
      return ok(attempts);
    }

    await verifyCourseOwner(caller, lesson.module.courseId);
    const attempts = await getQuizSubmissionsForTeacher(quiz.id);

    return ok(attempts);
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
    console.error("[GET /api/lessons/:lessonId/quiz/attempts]", err);
    return serverError();
  }
}
