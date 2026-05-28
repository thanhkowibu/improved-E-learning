/**
 * app/api/courses/[courseId]/modules/route.ts
 *
 * GET /api/courses/:courseId/modules — List all modules for a course.
 *   Access: Public (if course is published) | Owner | ADMIN
 *
 * POST /api/courses/:courseId/modules — Create a new module.
 *   Access: Course owner (TEACHER) or ADMIN
 *
 * PUT  /api/courses/:courseId/modules — Bulk reorder modules.
 *   Body: { orderedIds: string[] }
 *   Access: Course owner (TEACHER) or ADMIN
 *
 * Security: Zero Trust — every GET checks course publication status
 * independently. We do NOT delegate visibility decisions to the course
 * endpoint; each route enforces its own access policy.
 */

import { type NextRequest } from "next/server";
import { ZodError, z } from "zod";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { verifyCourseOwner } from "@/lib/auth/check-ownership";
import { moduleCreateSchema } from "@/lib/validations/module";
import {
  getModulesByCourse,
  createModule,
  reorderModules,
} from "@/lib/services/module.service";
import prisma from "@/lib/prisma";
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

// ─── Shared gate helper ───────────────────────────────────────────────────────

/**
 * Fetches only the fields required for the publication gate check.
 * A single SELECT with three columns — minimal I/O per request.
 *
 * Returns null if the course does not exist (caller maps to 404).
 */
async function fetchCourseGate(courseId: string) {
  return prisma.course.findUnique({
    where: { id: courseId },
    select: { isPublished: true, teacherId: true },
  });
}

// ─── GET /api/courses/:courseId/modules ───────────────────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { courseId } = await context.params;

    // Step 1: fetch minimal course fields for the gate check.
    const course = await fetchCourseGate(courseId);
    if (!course) {
      return notFound(`Course with id "${courseId}" not found.`);
    }

    // Step 2: if the course is unpublished, require owner or ADMIN auth.
    if (!course.isPublished) {
      try {
        const caller = await getAuthUser(request);
        const isOwner = course.teacherId === caller.id;
        const isAdmin = caller.role === "ADMIN";
        if (!isOwner && !isAdmin) {
          // Return 404 — not 403 — to avoid leaking that the course exists.
          return notFound("Course not found or not yet published.");
        }
      } catch (authErr) {
        // Unauthenticated callers hitting an unpublished course → 404.
        if (authErr instanceof AuthError) {
          return notFound("Course not found or not yet published.");
        }
        throw authErr; // unexpected error — rethrow
      }
    }

    // Step 3: return the module list.
    const modules = await getModulesByCourse(courseId);
    return ok(modules);
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[GET /api/courses/:courseId/modules]", err);
    return serverError();
  }
}

// ─── POST /api/courses/:courseId/modules ──────────────────────────────────────

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { courseId } = await context.params;
    const caller = await getAuthUser(request);

    // verifyCourseOwner confirms the course exists AND the caller is allowed.
    await verifyCourseOwner(caller, courseId);

    const body = await request.json();
    const parsed = moduleCreateSchema.parse(body);

    const mod = await createModule(courseId, parsed);
    return created(mod, "Module created successfully.");
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
    console.error("[POST /api/courses/:courseId/modules]", err);
    return serverError();
  }
}

// ─── PUT /api/courses/:courseId/modules (bulk reorder) ────────────────────────

const reorderSchema = z.object({
  orderedIds: z
    .array(z.string().uuid("Each id must be a valid UUID."), {
      error: "orderedIds must be an array of module UUIDs.",
    })
    .min(1, "orderedIds must contain at least one id."),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { courseId } = await context.params;
    const caller = await getAuthUser(request);

    await verifyCourseOwner(caller, courseId);

    const body = await request.json();
    const { orderedIds } = reorderSchema.parse(body);

    const modules = await reorderModules(courseId, orderedIds);
    return ok(modules, "Modules reordered successfully.");
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
    if (err instanceof Error) {
      if (err.message.includes("not found")) return notFound(err.message);
      if (err.message.includes("do not belong")) return badRequest(err.message);
    }
    console.error("[PUT /api/courses/:courseId/modules]", err);
    return serverError();
  }
}
