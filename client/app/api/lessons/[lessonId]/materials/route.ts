/**
 * app/api/lessons/[lessonId]/materials/route.ts
 *
 * GET /api/lessons/:lessonId/materials
 *   Returns all materials attached to a lesson.
 *   Access: Public if the parent course is published | Owner | ADMIN
 */

import { type NextRequest } from "next/server";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { getLessonById } from "@/lib/services/lesson.service";
import { getMaterialsByLesson } from "@/lib/services/material.service";
import { ok, unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";

type RouteContext = { params: Promise<{ lessonId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { lessonId } = await context.params;

    // Resolve the full chain to check publication state.
    const lesson = await getLessonById(lessonId);

    if (!lesson.module.course.isPublished) {
      try {
        const caller = await getAuthUser(request);
        const isOwner = lesson.module.course.teacherId === caller.id;
        const isAdmin = caller.role === "ADMIN";
        if (!isOwner && !isAdmin) {
          return notFound("Lesson not found or course is not yet published.");
        }
      } catch (authErr) {
        if (authErr instanceof AuthError) {
          return notFound("Lesson not found or course is not yet published.");
        }
        throw authErr;
      }
    }

    const materials = await getMaterialsByLesson(lessonId);
    return ok(materials);
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[GET /api/lessons/:lessonId/materials]", err);
    return serverError();
  }
}
