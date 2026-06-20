/**
 * app/api/enrollments/my/route.ts
 *
 * GET /api/enrollments/my
 *   Returns the authenticated student's enrolled courses with full course,
 *   teacher summary, and module/enrollment counts.
 *
 *   Access: Any authenticated user (STUDENTs see their own; TEACHERs/ADMINs
 *   calling this get their own enrollment records, if any).
 *
 * Query params:
 *   ?status=ACTIVE|COMPLETED|DROPPED  — filter by status (default: all)
 *   ?search=<course title substring>
 *   ?page=1
 *   ?limit=20
 */

import { type NextRequest } from "next/server";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { getMyEnrollments } from "@/lib/services/enrollment.service";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api-response";
import { EnrollmentStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const caller = await getAuthUser(request);

    // Parse optional status filter from query params.
    const { searchParams } = request.nextUrl;
    const rawStatus = searchParams.get("status")?.toUpperCase();
    const search = searchParams.get("search")?.trim() || undefined;
    const page = Math.max(
      1,
      Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
    );
    const limit = Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(searchParams.get("limit") ?? "20", 10) || 20,
      ),
    );

    let statusFilter: EnrollmentStatus | undefined;
    if (rawStatus) {
      if (!Object.values(EnrollmentStatus).includes(rawStatus as EnrollmentStatus)) {
        return badRequest(
          `Invalid status "${rawStatus}". Must be ACTIVE, COMPLETED, or DROPPED.`
        );
      }
      statusFilter = rawStatus as EnrollmentStatus;
    }

    const enrollments = await getMyEnrollments(caller.id, statusFilter, {
      search,
      page,
      limit,
    });
    return ok(enrollments);
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    console.error("[GET /api/enrollments/my]", err);
    return serverError();
  }
}
