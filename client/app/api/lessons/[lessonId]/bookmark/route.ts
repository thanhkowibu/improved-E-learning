import { type NextRequest } from "next/server";
import { AuthError, getAuthUser } from "@/lib/auth/get-auth-user";
import { toggleLessonBookmark } from "@/lib/services/bookmark.service";
import { notFound, ok, serverError, unauthorized, forbidden } from "@/lib/api-response";

type RouteContext = { params: Promise<{ lessonId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { lessonId } = await context.params;
    const caller = await getAuthUser(request);
    const result = await toggleLessonBookmark(caller.id, lessonId);

    return ok(result, result.bookmarked ? "Đã lưu bài học." : "Đã bỏ lưu bài học.");
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403
        ? forbidden(err.message)
        : unauthorized(err.message);
    }

    if (err instanceof Error && err.message.includes("not found")) {
      return notFound("Không tìm thấy bài học.");
    }

    console.error("[POST /api/lessons/:lessonId/bookmark]", err);
    return serverError("Không thể cập nhật đánh dấu bài học.");
  }
}
