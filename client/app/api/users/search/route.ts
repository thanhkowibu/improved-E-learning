/**
 * app/api/users/search/route.ts
 *
 * GET /api/users/search?q=query
 *   Lightweight student search for teacher enrollment workflows.
 *   Access: TEACHER / ADMIN.
 */

import { type NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { requireRole } from "@/lib/auth/require-role";
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  serverError,
} from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const caller = await getAuthUser(request);
    requireRole(caller, [UserRole.TEACHER, UserRole.ADMIN]);

    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (query.length < 2) {
      return badRequest("Vui lòng nhập ít nhất 2 ký tự để tìm kiếm.");
    }

    const users = await prisma.user.findMany({
      where: {
        role: UserRole.STUDENT,
        isActive: true,
        OR: [
          { email: { contains: query, mode: "insensitive" } },
          { fullName: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        avatarUrl: true,
      },
      orderBy: { fullName: "asc" },
      take: 8,
    });

    return ok(users);
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    console.error("[GET /api/users/search]", err);
    return serverError();
  }
}
