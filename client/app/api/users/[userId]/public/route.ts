import { type NextRequest } from "next/server";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { getPublicUserProfile } from "@/lib/services/user.service";
import {
  ok,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api-response";

type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await context.params;
    await getAuthUser(request);

    const profile = await getPublicUserProfile(userId);
    return ok(profile);
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound("Không tìm thấy hồ sơ người dùng.");
    }
    console.error("[GET /api/users/:userId/public]", err);
    return serverError();
  }
}
