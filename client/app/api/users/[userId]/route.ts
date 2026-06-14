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
import { userSelfUpdateSchema } from "@/lib/validations/user";
import {
  getUserById,
  getUserWithPasswordById,
  updateUser,
  updateUserPassword,
  deactivateUser,
} from "@/lib/services/user.service";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
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
      return forbidden("Bạn không có quyền xem thông tin người dùng này.");
    }

    const user = await getUserById(userId);
    return ok(user);
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403
        ? forbidden(err.message)
        : unauthorized(err.message);
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

    if (caller.id !== userId) {
      return forbidden("Bạn chỉ có thể cập nhật tài khoản của chính mình.");
    }

    const body = await request.json();
    const parsed = userSelfUpdateSchema.parse(body);

    const profileUpdates = {
      fullName: parsed.fullName,
      avatarUrl: parsed.avatarUrl,
      phoneNumber: parsed.phoneNumber,
      gender: parsed.gender,
      birthYear: parsed.birthYear,
      highestEducation: parsed.highestEducation,
      bio: parsed.bio,
    };

    const hasProfileUpdates = Object.values(profileUpdates).some(
      (value) => value !== undefined,
    );
    const isChangingPassword = Boolean(
      parsed.currentPassword && parsed.newPassword,
    );

    if (!hasProfileUpdates && !isChangingPassword) {
      return badRequest("Vui lòng cung cấp thông tin cần cập nhật.");
    }

    if (isChangingPassword) {
      const userWithPassword = await getUserWithPasswordById(userId);
      const passwordMatches = await verifyPassword(
        parsed.currentPassword as string,
        userWithPassword.hashedPassword,
      );

      if (!passwordMatches) {
        return badRequest("Mật khẩu hiện tại không chính xác.");
      }
    }

    let updated = hasProfileUpdates
      ? await updateUser(userId, profileUpdates)
      : await getUserById(userId);

    if (isChangingPassword) {
      const hashedPassword = await hashPassword(parsed.newPassword as string);
      updated = await updateUserPassword(userId, hashedPassword);
    }

    return ok(updated, "Cập nhật tài khoản thành công.");
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403
        ? forbidden(err.message)
        : unauthorized(err.message);
    }
    if (err instanceof ZodError) {
      const errors = err.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      return badRequest("Dữ liệu không hợp lệ.", errors);
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound("Không tìm thấy người dùng.");
    }
    console.error("[PATCH /api/users/:userId]", err);
    return serverError();
  }
}

// ─── DELETE /api/users/:userId ───────────────────────────────────────────────────

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
      return err.status === 403
        ? forbidden(err.message)
        : unauthorized(err.message);
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[DELETE /api/users/:userId]", err);
    return serverError();
  }
}
