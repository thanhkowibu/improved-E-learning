/**
 * app/api/courses/[courseId]/progress/route.ts
 *
 * GET /api/courses/:courseId/progress
 *
 * Returns the authenticated student's progress for every lesson in this course,
 * expressed as a flat array of completed lesson IDs.
 *
 * Response shape:
 *   { completedLessonIds: string[] }
 *
 * Strategy:
 *   1. Verify the course exists.
 *   2. Collect all lesson IDs belonging to this course (via module relation).
 *   3. Query LessonProgress for all records where studentId = caller.id AND
 *      lessonId IN [all lesson IDs] AND isCompleted = true.
 *   4. Return the matching lesson IDs.
 *
 * Non-students (TEACHER / ADMIN) receive an empty array — progress is a
 * student-only concept in this system.
 *
 * Access: Authenticated users (auth required so we can resolve the student ID).
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
} from "@/lib/api-response";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { courseId } = await context.params;
    const caller = await getAuthUser(request);

    // Verify the course exists (a 404 is friendlier than returning empty data
    // for a non-existent resource).
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) return notFound("Course not found.");

    // Non-students have no lesson progress — return an empty set immediately.
    if (caller.role !== "STUDENT") {
      return ok({ completedLessonIds: [] });
    }

    // Collect all lesson IDs in this course via their modules.
    const modules = await prisma.module.findMany({
      where: { courseId },
      select: {
        lessons: {
          select: { id: true },
        },
      },
    });

    const allLessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));

    if (allLessonIds.length === 0) {
      return ok({ completedLessonIds: [] });
    }

    // Find all completed progress records for this student in this course.
    const progressRecords = await prisma.lessonProgress.findMany({
      where: {
        studentId: caller.id,
        lessonId: { in: allLessonIds },
        isCompleted: true,
      },
      select: { lessonId: true },
    });

    const completedLessonIds = progressRecords.map((r) => r.lessonId);

    return ok({ completedLessonIds });
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    console.error("[GET /api/courses/:courseId/progress]", err);
    return serverError();
  }
}
