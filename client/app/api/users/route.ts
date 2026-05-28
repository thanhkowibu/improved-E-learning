/**
 * app/api/users/route.ts
 *
 * GET /api/users
 * Access: ADMIN only
 *
 * Returns a paginated list of all platform users.
 *
 * Query parameters:
 *  ?page=1   — page number (default: 1)
 *  ?limit=20 — items per page (default: 20, max: 100)
 */

import { type NextRequest } from "next/server";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { requireRole, UserRole } from "@/lib/auth/require-role";
import { getAllUsers } from "@/lib/services/user.service";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    // 1. Auth + role guard.
    const caller = await getAuthUser(request);
    requireRole(caller, [UserRole.ADMIN]);

    // 2. Parse + validate pagination query params.
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.max(
      1,
      Math.min(100, parseInt(searchParams.get("limit") ?? "20", 10) || 20)
    );

    // 3. Delegate to service.
    const result = await getAllUsers({ page, limit });

    return ok(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    console.error("[GET /api/users]", err);
    return serverError();
  }
}
