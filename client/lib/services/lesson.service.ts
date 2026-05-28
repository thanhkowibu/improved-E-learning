/**
 * lib/services/lesson.service.ts
 *
 * All database operations for the Lesson model.
 *
 * Authorization note:
 *   Lessons don't have a direct courseId — you reach the course through:
 *     Lesson → Module → Course
 *   So ownership checks in route handlers must fetch the module first to
 *   get the courseId, then call verifyCourseOwner(caller, module.courseId).
 *   The helpers `getModuleForAuth` and `assertLessonInModule` below
 *   facilitate this without duplicating DB queries.
 */

import prisma from "@/lib/prisma";
import type { LessonCreateInput, LessonUpdateInput } from "@/lib/validations/lesson";

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Fetches a module's id + courseId. Used by route handlers to resolve the
 * courseId needed for verifyCourseOwner before any write operation.
 *
 * @throws Error (→ 404) if the module does not exist.
 */
export async function getModuleForAuth(moduleId: string) {
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { id: true, courseId: true },
  });
  if (!mod) {
    throw new Error(`Module with id "${moduleId}" not found.`);
  }
  return mod;
}

/**
 * Confirms a lesson belongs to the expected module.
 * Prevents cross-module URL manipulation (e.g., /modules/badId/lessons/realId).
 *
 * @throws Error (→ 404) if not found or wrong module.
 */
async function assertLessonInModule(lessonId: string, moduleId: string) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, moduleId },
  });
  if (!lesson) {
    throw new Error(
      `Lesson with id "${lessonId}" not found in module "${moduleId}".`
    );
  }
  return lesson;
}

// ─── getLessonsByModule ───────────────────────────────────────────────────────

/**
 * Returns all lessons for a module, ordered by orderIndex ascending.
 * Content is excluded here (expensive field); use getLessonById for full detail.
 */
export async function getLessonsByModule(moduleId: string) {
  return prisma.lesson.findMany({
    where: { moduleId },
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      title: true,
      orderIndex: true,
      moduleId: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { materials: true } },
    },
  });
}

// ─── getLessonById ────────────────────────────────────────────────────────────

/**
 * Returns a single lesson with its full content and related materials.
 * Also returns the parent module summary so callers know the courseId
 * without an extra query.
 *
 * @throws Error if the lesson is not found.
 */
export async function getLessonById(lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      materials: {
        orderBy: { createdAt: "asc" },
      },
      module: {
        select: {
          id: true,
          title: true,
          courseId: true,
          course: {
            select: { id: true, title: true, teacherId: true, isPublished: true },
          },
        },
      },
    },
  });

  if (!lesson) {
    throw new Error(`Lesson with id "${lessonId}" not found.`);
  }

  return lesson;
}

// ─── createLesson ─────────────────────────────────────────────────────────────

/**
 * Creates a new lesson in `moduleId`, auto-appending its orderIndex.
 */
export async function createLesson(moduleId: string, data: LessonCreateInput) {
  const aggregate = await prisma.lesson.aggregate({
    where: { moduleId },
    _max: { orderIndex: true },
  });
  const nextOrder = (aggregate._max.orderIndex ?? -1) + 1;

  return prisma.lesson.create({
    data: {
      ...data,
      moduleId,
      orderIndex: nextOrder,
    },
    select: {
      id: true,
      title: true,
      content: true,
      orderIndex: true,
      moduleId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// ─── updateLesson ─────────────────────────────────────────────────────────────

/**
 * Partial update of a lesson. Validates the lesson belongs to `moduleId`
 * before writing.
 *
 * @throws Error if not found / wrong module.
 */
export async function updateLesson(
  lessonId: string,
  moduleId: string,
  data: LessonUpdateInput
) {
  await assertLessonInModule(lessonId, moduleId);

  return prisma.lesson.update({
    where: { id: lessonId },
    data,
    select: {
      id: true,
      title: true,
      content: true,
      orderIndex: true,
      moduleId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// ─── deleteLesson ─────────────────────────────────────────────────────────────

/**
 * Deletes a lesson. Prisma cascade removes all nested materials.
 *
 * @throws Error if not found / wrong module.
 */
export async function deleteLesson(lessonId: string, moduleId: string) {
  await assertLessonInModule(lessonId, moduleId);
  return prisma.lesson.delete({ where: { id: lessonId } });
}

// ─── reorderLessons ───────────────────────────────────────────────────────────

/**
 * Bulk-updates orderIndex for all lessons in a module atomically.
 * Body: { orderedIds: ["uuid1","uuid2",...] } — position = new orderIndex.
 *
 * @throws Error if any ID doesn't belong to `moduleId`.
 */
export async function reorderLessons(moduleId: string, orderedIds: string[]) {
  // Validate all submitted IDs belong to this module.
  const existing = await prisma.lesson.findMany({
    where: { moduleId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((l) => l.id));
  const invalid = orderedIds.filter((id) => !existingIds.has(id));
  if (invalid.length > 0) {
    throw new Error(
      `Lesson id(s) [${invalid.join(", ")}] do not belong to module "${moduleId}".`
    );
  }

  const updates = orderedIds.map((id, index) =>
    prisma.lesson.update({ where: { id }, data: { orderIndex: index } })
  );
  await prisma.$transaction(updates);

  return getLessonsByModule(moduleId);
}
