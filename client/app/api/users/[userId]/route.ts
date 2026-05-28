/**
 * app/api/users/[userId]/route.ts
 *
 * GET    /api/users/:userId  — Fetch user by ID.     Access: ADMIN or self.
 * PATCH  /api/users/:userId  — Partial update.       Access: ADMIN or self.
 * DELETE /api/users/:userId  — Soft-delete (deactivate). Access: ADMIN only.
 */

import { type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { requireRole, UserRole } from "@/lib/auth/require-role";
import {
  userSelfUpdateSchema,
  userAdminUpdateSchema,
} from "@/lib/validations/user";
import {
  getUserById,
  updateUser,
  deactivateUser,
} from "@/lib/services/user.service";
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api-response";

// ─── Shared route context type ────────────────────────────────────────────────

type RouteContext = { params: Promise<{ userId: string }> };

// ─── GET /api/users/:userId ───────────────────────────────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await context.params;
    const caller = await getAuthUser(request);

    // ADMIN can fetch anyone; users can only fetch themselves.
    const isSelf = caller.id === userId;
    const isAdmin = caller.role === UserRole.ADMIN;

    if (!isSelf && !isAdmin) {
      return forbidden("You do not have permission to view this user.");
    }

    const user = await getUserById(userId);
    return ok(user);
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[GET /api/users/:userId]", err);
    return serverError();
  }
}

// ─── PATCH /api/users/:userId ─────────────────────────────────────────────────

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await context.params;
    const caller = await getAuthUser(request);

    const isSelf = caller.id === userId;
    const isAdmin = caller.role === UserRole.ADMIN;

    if (!isSelf && !isAdmin) {
      return forbidden("You do not have permission to update this user.");
    }

    const body = await request.json();

    // ADMIN gets the wider schema (includes isActive).
    // Regular users get the narrower self-update schema.
    const schema = isAdmin ? userAdminUpdateSchema : userSelfUpdateSchema;
    const parsed = schema.parse(body);

    // Prevent an empty PATCH (no-op).
    if (Object.keys(parsed).length === 0) {
      return badRequest("Request body must contain at least one field to update.");
    }

    const updated = await updateUser(userId, parsed);
    return ok(updated, "User updated successfully.");
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    if (err instanceof ZodError) {
      const errors = err.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      return badRequest("Validation failed.", errors);
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[PATCH /api/users/:userId]", err);
    return serverError();
  }
}

// ─── DELETE /api/users/:userId ────────────────────────────────────────────────

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await context.params;
    const caller = await getAuthUser(request);

    // Only ADMINs can deactivate accounts.
    requireRole(caller, [UserRole.ADMIN]);

    // Prevent an ADMIN from deactivating their own account
    // (would lock them out of the system).
    if (caller.id === userId) {
      return forbidden("You cannot deactivate your own account.");
    }

    const deactivated = await deactivateUser(userId);
    return ok(deactivated, "User account has been deactivated.");
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[DELETE /api/users/:userId]", err);
    return serverError();
  }
}
