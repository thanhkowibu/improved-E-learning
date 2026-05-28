/**
 * app/api/courses/route.ts
 *
 * GET  /api/courses  — List courses (role-aware, paginated, searchable).
 *   Access: Public (published only) | TEACHER (own) | ADMIN (all)
 *
 * POST /api/courses  — Create a new course.
 *   Access: TEACHER, ADMIN
 *
 * Query params for GET:
 *   ?page=1 ?limit=20 ?search=<title substring>
 */

import { type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { requireRole, UserRole } from "@/lib/auth/require-role";
import { courseCreateSchema } from "@/lib/validations/course";
import { getCourses, createCourse } from "@/lib/services/course.service";
import {
  ok,
  created,
  badRequest,
  unauthorized,
  forbidden,
  serverError,
} from "@/lib/api-response";

// ─── GET /api/courses ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // Auth is optional for GET — guests see published courses.
    let callerRole: UserRole | null = null;
    let callerId: string | null = null;

    try {
      const caller = await getAuthUser(request);
      callerRole = caller.role;
      callerId = caller.id;
    } catch {
      // Unauthenticated — defaults remain null → published-only filter.
    }

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
    const search = searchParams.get("search")?.trim() || undefined;

    const result = await getCourses({ page, limit, search, callerRole, callerId });

    return ok(result);
  } catch (err) {
    console.error("[GET /api/courses]", err);
    return serverError();
  }
}

// ─── POST /api/courses ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const caller = await getAuthUser(request);
    requireRole(caller, [UserRole.TEACHER, UserRole.ADMIN]);

    const body = await request.json();
    const parsed = courseCreateSchema.parse(body);

    // teacherId is always derived from the authenticated user — never the body.
    const course = await createCourse(parsed, caller.id);

    return created(course, "Course created successfully.");
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    if (err instanceof ZodError) {
      return badRequest("Validation failed.", err.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })));
    }
    console.error("[POST /api/courses]", err);
    return serverError();
  }
}