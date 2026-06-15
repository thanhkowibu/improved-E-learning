import { type NextRequest } from "next/server";
import { AuthError, getAuthUser } from "@/lib/auth/get-auth-user";
import { verifyCourseOwner } from "@/lib/auth/check-ownership";
import { getCourseQuizAnalytics } from "@/lib/services/quiz.service";
import {
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "@/lib/api-response";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { courseId } = await context.params;
    const caller = await getAuthUser(request);

    await verifyCourseOwner(caller, courseId);

    const analytics = await getCourseQuizAnalytics(courseId);

    return ok(analytics);
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403
        ? forbidden(err.message)
        : unauthorized(err.message);
    }

    if (err instanceof Error && err.message.includes("not found")) {
      return notFound("Không tìm thấy khóa học.");
    }

    console.error("[GET /api/courses/:courseId/analytics/quizzes]", err);
    return serverError("Không thể tải thống kê quiz.");
  }
}
