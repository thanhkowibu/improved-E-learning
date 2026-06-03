/**
 * app/api/lessons/[lessonId]/progress/route.ts
 *
 * GET  /api/lessons/:lessonId/progress
 *   Returns the authenticated student's completion status for this lesson.
 *   { isCompleted: boolean }
 *
 * PUT  /api/lessons/:lessonId/progress
 *   Toggle (upsert) the student's completion status.
 *   Body: { isCompleted: boolean }
 *   Returns the updated LessonProgress record.
 *
 * Access: STUDENT only (teachers/admins have no progress to track).
 */

import { type NextRequest } from "next/server";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import prisma from "@/lib/prisma";
import {
  ok,
  unauthorized,
  forbidden,
  notFound,
  serverError,
  badRequest,
} from "@/lib/api-response";

type RouteContext = { params: Promise<{ lessonId: string }> };

// ─── GET /api/lessons/:lessonId/progress ──────────────────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { lessonId } = await context.params;
    const caller = await getAuthUser(request);

    // Verify the lesson exists.
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true },
    });
    if (!lesson) return notFound("Lesson not found.");

    const progress = await prisma.lessonProgress.findUnique({
      where: { studentId_lessonId: { studentId: caller.id, lessonId } },
      select: { isCompleted: true, updatedAt: true },
    });

    return ok({ isCompleted: progress?.isCompleted ?? false });
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    console.error("[GET /api/lessons/:lessonId/progress]", err);
    return serverError();
  }
}

// ─── PUT /api/lessons/:lessonId/progress ──────────────────────────────────────

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { lessonId } = await context.params;
    const caller = await getAuthUser(request);

    const body = await request.json().catch(() => null);
    if (body === null || typeof body.isCompleted !== "boolean") {
      return badRequest("Request body must contain { isCompleted: boolean }.");
    }

    // Verify the lesson exists before upserting.
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true },
    });
    if (!lesson) return notFound("Lesson not found.");

    const progress = await prisma.lessonProgress.upsert({
      where: { studentId_lessonId: { studentId: caller.id, lessonId } },
      create: {
        studentId: caller.id,
        lessonId,
        isCompleted: body.isCompleted,
      },
      update: {
        isCompleted: body.isCompleted,
      },
      select: {
        id: true,
        lessonId: true,
        studentId: true,
        isCompleted: true,
        updatedAt: true,
      },
    });

    return ok(progress, body.isCompleted ? "Lesson marked as complete!" : "Lesson marked as incomplete.");
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    console.error("[PUT /api/lessons/:lessonId/progress]", err);
    return serverError();
  }
}
