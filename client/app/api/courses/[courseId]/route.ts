/**
 * app/api/courses/[courseId]/route.ts
 *
 * GET    /api/courses/:courseId  — Course detail with full module/lesson tree.
 *   Access: Public (if published) | Enrolled student | Owner | ADMIN
 *
 * PATCH  /api/courses/:courseId  — Partial update.
 *   Access: Course owner (TEACHER) or ADMIN
 *
 * DELETE /api/courses/:courseId  — Hard delete with cascade.
 *   Access: Course owner (TEACHER) or ADMIN
 */

import { type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { verifyCourseOwner } from "@/lib/auth/check-ownership";
import { courseUpdateSchema } from "@/lib/validations/course";
import {
  getCourseById,
  updateCourse,
  deleteCourse,
} from "@/lib/services/course.service";
import {
  ok,
  noContent,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api-response";

// ─── Route context ────────────────────────────────────────────────────────────

type RouteContext = { params: Promise<{ courseId: string }> };

// ─── GET /api/courses/:courseId ───────────────────────────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { courseId } = await context.params;

    const course = await getCourseById(courseId);

    // If the course is unpublished, only the owner or an ADMIN may see it.
    if (!course.isPublished) {
      try {
        const caller = await getAuthUser(request);
        const isOwner = course.teacherId === caller.id;
        const isAdmin = caller.role === "ADMIN";
        if (!isOwner && !isAdmin) {
          return notFound("Course not found or not yet published.");
        }
      } catch {
        // Unauthenticated user hitting an unpublished course → 404.
        return notFound("Course not found or not yet published.");
      }
    }

    return ok(course);
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[GET /api/courses/:courseId]", err);
    return serverError();
  }
}

// ─── PATCH /api/courses/:courseId ─────────────────────────────────────────────

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { courseId } = await context.params;
    const caller = await getAuthUser(request);

    // verifyCourseOwner throws if course not found (→ 404) or caller lacks
    // permission (→ 403). It also returns the course to avoid an extra query.
    await verifyCourseOwner(caller, courseId);

    const body = await request.json();
    const parsed = courseUpdateSchema.parse(body);

    if (Object.keys(parsed).length === 0) {
      return badRequest("Request body must contain at least one field to update.");
    }

    const updated = await updateCourse(courseId, parsed);
    return ok(updated, "Course updated successfully.");
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
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[PATCH /api/courses/:courseId]", err);
    return serverError();
  }
}

// ─── DELETE /api/courses/:courseId ────────────────────────────────────────────

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { courseId } = await context.params;
    const caller = await getAuthUser(request);

    await verifyCourseOwner(caller, courseId);

    // Prisma cascade (defined in schema.prisma) automatically removes:
    //   modules → lessons → materials, enrollments, chatThreads → chatMessages
    await deleteCourse(courseId);

    return noContent();
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[DELETE /api/courses/:courseId]", err);
    return serverError();
  }
}
