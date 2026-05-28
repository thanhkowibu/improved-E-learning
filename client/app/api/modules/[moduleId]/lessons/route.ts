/**
 * app/api/modules/[moduleId]/lessons/route.ts
 *
 * GET /api/modules/:moduleId/lessons — List all lessons for a module.
 *   Access: Public (module is reachable if the course is published)
 *
 * POST /api/modules/:moduleId/lessons — Create a new lesson.
 *   Access: Course owner (TEACHER) or ADMIN
 *
 * PUT  /api/modules/:moduleId/lessons — Bulk reorder lessons.
 *   Body: { orderedIds: string[] }
 *   Access: Course owner (TEACHER) or ADMIN
 *
 * Auth pattern for writes:
 *   1. getModuleForAuth(moduleId) → get moduleId + courseId
 *   2. verifyCourseOwner(caller, courseId) → confirm ownership
 */

import { type NextRequest } from "next/server";
import { ZodError, z } from "zod";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { verifyCourseOwner } from "@/lib/auth/check-ownership";
import { lessonCreateSchema } from "@/lib/validations/lesson";
import {
  getModuleForAuth,
  getLessonsByModule,
  createLesson,
  reorderLessons,
} from "@/lib/services/lesson.service";
import {
  ok,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api-response";

type RouteContext = { params: Promise<{ moduleId: string }> };

// ─── GET /api/modules/:moduleId/lessons ───────────────────────────────────────

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { moduleId } = await context.params;

    // Validate the module exists (throws → 404 if not).
    await getModuleForAuth(moduleId);

    const lessons = await getLessonsByModule(moduleId);
    return ok(lessons);
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[GET /api/modules/:moduleId/lessons]", err);
    return serverError();
  }
}

// ─── POST /api/modules/:moduleId/lessons ──────────────────────────────────────

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { moduleId } = await context.params;
    const caller = await getAuthUser(request);

    // Step 1: resolve courseId from the module.
    const mod = await getModuleForAuth(moduleId);

    // Step 2: verify the caller owns the parent course.
    await verifyCourseOwner(caller, mod.courseId);

    const body = await request.json();
    const parsed = lessonCreateSchema.parse(body);

    const lesson = await createLesson(moduleId, parsed);
    return created(lesson, "Lesson created successfully.");
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
    console.error("[POST /api/modules/:moduleId/lessons]", err);
    return serverError();
  }
}

// ─── PUT /api/modules/:moduleId/lessons (bulk reorder) ────────────────────────

const reorderSchema = z.object({
  orderedIds: z
    .array(z.string().uuid("Each id must be a valid UUID."), {
      error: "orderedIds must be an array of lesson UUIDs.",
    })
    .min(1, "orderedIds must contain at least one id."),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { moduleId } = await context.params;
    const caller = await getAuthUser(request);

    const mod = await getModuleForAuth(moduleId);
    await verifyCourseOwner(caller, mod.courseId);

    const body = await request.json();
    const { orderedIds } = reorderSchema.parse(body);

    const lessons = await reorderLessons(moduleId, orderedIds);
    return ok(lessons, "Lessons reordered successfully.");
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
    console.error("[PUT /api/modules/:moduleId/lessons]", err);
    return serverError();
  }
}
