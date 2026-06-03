/**
 * app/api/users/[userId]/status/route.ts
 *
 * PATCH /api/users/:userId/status
 *
 * Toggles a user's `isActive` field (deactivate ↔ reactivate).
 * Only ADMIN may call this endpoint.
 * An ADMIN cannot deactivate their own account.
 *
 * Request body: { isActive: boolean }
 * Response:     { success: true, data: SafeUser }
 */

import { type NextRequest } from "next/server";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { requireRole, UserRole } from "@/lib/auth/require-role";
import { updateUser, getUserById } from "@/lib/services/user.service";
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api-response";
import { z } from "zod";

type RouteContext = { params: Promise<{ userId: string }> };

const statusSchema = z.object({
  isActive: z.boolean(),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await context.params;
    const caller = await getAuthUser(request);

    // ADMIN-only guard
    requireRole(caller, [UserRole.ADMIN]);

    // Prevent self-deactivation
    if (caller.id === userId) {
      return forbidden("You cannot change the active status of your own account.");
    }

    // Parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest("Request body must be valid JSON.");
    }

    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Body must contain { isActive: boolean }.");
    }

    // Verify user exists
    let existing;
    try {
      existing = await getUserById(userId);
    } catch {
      return notFound(`User with id "${userId}" not found.`);
    }

    // No-op guard (already in the requested state)
    if (existing.isActive === parsed.data.isActive) {
      return ok(existing, `User is already ${parsed.data.isActive ? "active" : "inactive"}.`);
    }

    const updated = await updateUser(userId, { isActive: parsed.data.isActive });

    return ok(
      updated,
      `User has been ${parsed.data.isActive ? "reactivated" : "deactivated"} successfully.`
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    console.error("[PATCH /api/users/:userId/status]", err);
    return serverError();
  }
}
