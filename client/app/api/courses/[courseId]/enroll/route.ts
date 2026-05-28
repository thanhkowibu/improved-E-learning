/**
 * app/api/courses/[courseId]/enroll/route.ts
 *
 * POST   /api/courses/:courseId/enroll
 *   Enroll the authenticated student in a course.
 *   Access: STUDENT only (TEACHERs own courses, ADMINs manage via admin routes)
 *
 * DELETE /api/courses/:courseId/enroll
 *   Drop the enrollment (soft-remove: status → DROPPED).
 *   Access: STUDENT only (the enrolled student themselves)
 */

import { type NextRequest } from "next/server";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { requireRole, UserRole } from "@/lib/auth/require-role";
import { enrollStudent, dropEnrollment } from "@/lib/services/enrollment.service";
import {
  ok,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api-response";

type RouteContext = { params: Promise<{ courseId: string }> };

// ─── POST /api/courses/:courseId/enroll ───────────────────────────────────────

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { courseId } = await context.params;
    const caller = await getAuthUser(request);

    // Only students enroll — teachers create, admins manage.
    requireRole(caller, [UserRole.STUDENT]);

    const enrollment = await enrollStudent(caller.id, courseId);
    return created(enrollment, "Successfully enrolled in the course.");
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    if (err instanceof Error) {
      if (err.message.includes("not found")) return notFound(err.message);
      if (
        err.message.includes("already enrolled") ||
        err.message.includes("not yet published")
      ) {
        return badRequest(err.message);
      }
    }
    console.error("[POST /api/courses/:courseId/enroll]", err);
    return serverError();
  }
}

// ─── DELETE /api/courses/:courseId/enroll ─────────────────────────────────────

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { courseId } = await context.params;
    const caller = await getAuthUser(request);

    requireRole(caller, [UserRole.STUDENT]);

    const enrollment = await dropEnrollment(caller.id, courseId);
    return ok(enrollment, "You have successfully dropped this course.");
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    if (err instanceof Error) {
      if (
        err.message.includes("not enrolled") ||
        err.message.includes("already dropped")
      ) {
        return badRequest(err.message);
      }
    }
    console.error("[DELETE /api/courses/:courseId/enroll]", err);
    return serverError();
  }
}
