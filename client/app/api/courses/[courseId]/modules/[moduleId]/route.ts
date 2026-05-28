/**
 * app/api/courses/[courseId]/modules/[moduleId]/route.ts
 *
 * GET    /api/courses/:courseId/modules/:moduleId — Module detail with lessons.
 *   Access: Public (if course is published) | Owner | ADMIN
 *
 * PATCH  /api/courses/:courseId/modules/:moduleId — Update module.
 *   Access: Course owner (TEACHER) or ADMIN
 *
 * DELETE /api/courses/:courseId/modules/:moduleId — Delete module + cascade.
 *   Access: Course owner (TEACHER) or ADMIN
 *
 * Security: Zero Trust — GET independently verifies course publication state.
 * The module's courseId is validated on every read/write to prevent
 * cross-course URL manipulation.
 */

import { type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { verifyCourseOwner } from "@/lib/auth/check-ownership";
import { moduleUpdateSchema } from "@/lib/validations/module";
import {
  getModuleById,
  updateModule,
  deleteModule,
} from "@/lib/services/module.service";
import prisma from "@/lib/prisma";
import {
  ok,
  noContent,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api-response";

type RouteContext = { params: Promise<{ courseId: string; moduleId: string }> };

// ─── Shared gate helper ───────────────────────────────────────────────────────

/**
 * Minimal SELECT — only the two fields needed for the publication gate.
 * Avoids fetching the full course on every GET request.
 */
async function fetchCourseGate(courseId: string) {
  return prisma.course.findUnique({
    where: { id: courseId },
    select: { isPublished: true, teacherId: true },
  });
}

// ─── GET /api/courses/:courseId/modules/:moduleId ─────────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { courseId, moduleId } = await context.params;

    // Step 1: gate check on the parent course.
    const course = await fetchCourseGate(courseId);
    if (!course) {
      return notFound(`Course with id "${courseId}" not found.`);
    }

    if (!course.isPublished) {
      try {
        const caller = await getAuthUser(request);
        const isOwner = course.teacherId === caller.id;
        const isAdmin = caller.role === "ADMIN";
        if (!isOwner && !isAdmin) {
          return notFound("Course not found or not yet published.");
        }
      } catch (authErr) {
        if (authErr instanceof AuthError) {
          return notFound("Course not found or not yet published.");
        }
        throw authErr;
      }
    }

    // Step 2: fetch the module (also validates it belongs to courseId).
    const mod = await getModuleById(moduleId, courseId);
    return ok(mod);
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[GET /api/courses/:courseId/modules/:moduleId]", err);
    return serverError();
  }
}

// ─── PATCH /api/courses/:courseId/modules/:moduleId ───────────────────────────

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { courseId, moduleId } = await context.params;
    const caller = await getAuthUser(request);

    await verifyCourseOwner(caller, courseId);

    const body = await request.json();
    const parsed = moduleUpdateSchema.parse(body);

    if (Object.keys(parsed).length === 0) {
      return badRequest("Request body must contain at least one field to update.");
    }

    const updated = await updateModule(moduleId, courseId, parsed);
    return ok(updated, "Module updated successfully.");
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
    console.error("[PATCH /api/courses/:courseId/modules/:moduleId]", err);
    return serverError();
  }
}

// ─── DELETE /api/courses/:courseId/modules/:moduleId ──────────────────────────

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { courseId, moduleId } = await context.params;
    const caller = await getAuthUser(request);

    await verifyCourseOwner(caller, courseId);
    await deleteModule(moduleId, courseId);

    return noContent();
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[DELETE /api/courses/:courseId/modules/:moduleId]", err);
    return serverError();
  }
}
