/**
 * app/api/courses/[courseId]/students/route.ts
 *
 * GET /api/courses/:courseId/students
 *   Returns a paginated list of students enrolled in a course.
 *   Access: Course owner (TEACHER) or ADMIN
 *
 * Query params:
 *   ?page=1         — page number (default: 1)
 *   ?limit=20       — items per page (default: 20, max: 100)
 *   ?status=ACTIVE  — filter by enrollment status (default: ACTIVE)
 */

import { type NextRequest } from "next/server";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { verifyCourseOwner } from "@/lib/auth/check-ownership";
import { getCourseStudents } from "@/lib/services/enrollment.service";
import { EnrollmentStatus } from "@prisma/client";
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api-response";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { courseId } = await context.params;
    const caller = await getAuthUser(request);

    // Only the course owner or an ADMIN may see the student list.
    await verifyCourseOwner(caller, courseId);

    // Parse query params.
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));

    const rawStatus = searchParams.get("status")?.toUpperCase();
    let statusFilter: EnrollmentStatus = EnrollmentStatus.ACTIVE; // sensible default
    if (rawStatus) {
      if (!Object.values(EnrollmentStatus).includes(rawStatus as EnrollmentStatus)) {
        return badRequest(
          `Invalid status "${rawStatus}". Must be ACTIVE, COMPLETED, or DROPPED.`
        );
      }
      statusFilter = rawStatus as EnrollmentStatus;
    }

    const result = await getCourseStudents(courseId, {
      status: statusFilter,
      page,
      limit,
    });

    return ok(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[GET /api/courses/:courseId/students]", err);
    return serverError();
  }
}
