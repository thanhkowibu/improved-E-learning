import { type NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { AuthError, getAuthUser } from "@/lib/auth/get-auth-user";
import { requireRole } from "@/lib/auth/require-role";
import { verifyCourseOwner } from "@/lib/auth/check-ownership";
import { getMaterialsByCourse } from "@/lib/services/material.service";
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

    requireRole(caller, [UserRole.TEACHER, UserRole.ADMIN]);
    await verifyCourseOwner(caller, courseId);

    const materials = await getMaterialsByCourse(courseId);

    return ok(materials);
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }

    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }

    console.error("[GET /api/courses/:courseId/materials]", err);
    return serverError();
  }
}
