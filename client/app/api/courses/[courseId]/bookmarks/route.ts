import { type NextRequest } from "next/server";
import { AuthError, getAuthUser } from "@/lib/auth/get-auth-user";
import { getCourseBookmarks } from "@/lib/services/bookmark.service";
import { forbidden, ok, serverError, unauthorized } from "@/lib/api-response";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { courseId } = await context.params;
    const caller = await getAuthUser(request);
    const bookmarks = await getCourseBookmarks(caller.id, courseId);

    return ok(bookmarks);
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403
        ? forbidden(err.message)
        : unauthorized(err.message);
    }

    console.error("[GET /api/courses/:courseId/bookmarks]", err);
    return serverError("Không thể tải danh sách bài học đã lưu.");
  }
}
