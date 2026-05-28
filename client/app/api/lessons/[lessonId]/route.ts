/**
 * app/api/lessons/[lessonId]/route.ts
 *
 * GET    /api/lessons/:lessonId — Full lesson detail (content + materials).
 *   Access: Public (if parent course is published) | Owner | ADMIN
 *
 * PATCH  /api/lessons/:lessonId — Update lesson.
 *   Access: Course owner (TEACHER) or ADMIN
 *
 * DELETE /api/lessons/:lessonId — Delete lesson + cascade materials.
 *   Access: Course owner (TEACHER) or ADMIN
 *
 * Auth pattern for writes:
 *   getLessonById includes lesson.module.courseId, so we resolve the full
 *   ownership chain in one query — no extra round-trip needed.
 */

import { type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { verifyCourseOwner } from "@/lib/auth/check-ownership";
import { lessonUpdateSchema } from "@/lib/validations/lesson";
import {
  getLessonById,
  updateLesson,
  deleteLesson,
} from "@/lib/services/lesson.service";
import {
  ok,
  noContent,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api-response";

type RouteContext = { params: Promise<{ lessonId: string }> };

// ─── GET /api/lessons/:lessonId ───────────────────────────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { lessonId } = await context.params;
    const lesson = await getLessonById(lessonId);

    // Gate unpublished-course lessons behind auth.
    if (!lesson.module.course.isPublished) {
      try {
        const caller = await getAuthUser(request);
        const isOwner = lesson.module.course.teacherId === caller.id;
        const isAdmin = caller.role === "ADMIN";
        if (!isOwner && !isAdmin) {
          return notFound("Lesson not found or course is not yet published.");
        }
      } catch {
        return notFound("Lesson not found or course is not yet published.");
      }
    }

    return ok(lesson);
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[GET /api/lessons/:lessonId]", err);
    return serverError();
  }
}

// ─── PATCH /api/lessons/:lessonId ─────────────────────────────────────────────

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { lessonId } = await context.params;
    const caller = await getAuthUser(request);

    // One query resolves the full chain: lesson + module.courseId + course.teacherId
    const lesson = await getLessonById(lessonId);
    await verifyCourseOwner(caller, lesson.module.courseId);

    const body = await request.json();
    const parsed = lessonUpdateSchema.parse(body);

    if (Object.keys(parsed).length === 0) {
      return badRequest("Request body must contain at least one field to update.");
    }

    const updated = await updateLesson(lessonId, lesson.moduleId, parsed);
    return ok(updated, "Lesson updated successfully.");
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
    console.error("[PATCH /api/lessons/:lessonId]", err);
    return serverError();
  }
}

// ─── DELETE /api/lessons/:lessonId ────────────────────────────────────────────

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { lessonId } = await context.params;
    const caller = await getAuthUser(request);

    const lesson = await getLessonById(lessonId);
    await verifyCourseOwner(caller, lesson.module.courseId);

    // deleteLesson validates the lesson→module relationship before deleting.
    // Prisma cascade removes all nested materials automatically.
    await deleteLesson(lessonId, lesson.moduleId);

    return noContent();
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[DELETE /api/lessons/:lessonId]", err);
    return serverError();
  }
}
