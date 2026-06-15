import { type NextRequest } from "next/server";
import { AuthError, getAuthUser } from "@/lib/auth/get-auth-user";
import { verifyEnrollment } from "@/lib/auth/check-enrollment";
import { getCourseById } from "@/lib/services/course.service";
import { getCompletedLessonIds } from "@/lib/services/progress.service";
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

    const course = await getCourseById(courseId);
    const allowed = await verifyEnrollment(caller, courseId);

    if (!allowed) {
      return forbidden("Bạn chưa có quyền truy cập khóa học này.");
    }

    const completedLessonIds =
      caller.role === "STUDENT"
        ? await getCompletedLessonIds(caller.id, courseId)
        : [];

    return ok({
      course,
      completedLessonIds,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403
        ? forbidden(err.message)
        : unauthorized(err.message);
    }

    if (err instanceof Error && err.message.includes("not found")) {
      return notFound("Không tìm thấy khóa học.");
    }

    console.error("[GET /api/courses/:courseId/learn]", err);
    return serverError("Không thể tải dữ liệu học tập.");
  }
}
