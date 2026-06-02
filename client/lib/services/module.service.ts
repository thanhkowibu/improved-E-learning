/**
 * lib/services/module.service.ts
 *
 * All database operations for the Module model.
 *
 * Key behaviours:
 *  - createModule: auto-calculates orderIndex (max existing + 1) so the UI
 *    never has to track ordering state during creation.
 *  - reorderModules: accepts an ordered array of module IDs and writes their
 *    new orderIndex values in a single $transaction.
 *  - All getters validate that the module belongs to the expected course,
 *    preventing cross-course access via URL manipulation.
 */

import prisma from "@/lib/prisma";
import type { ModuleCreateInput, ModuleUpdateInput } from "@/lib/validations/module";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Verifies that a module exists AND belongs to the given course.
 * Returns the module record so callers avoid an extra query.
 * Throws a plain Error with "not found" in the message on failure (→ 404).
 */
async function assertModuleBelongsToCourse(moduleId: string, courseId: string) {
  const mod = await prisma.module.findFirst({
    where: { id: moduleId, courseId },
  });
  if (!mod) {
    throw new Error(`Module with id "${moduleId}" not found in course "${courseId}".`);
  }
  return mod;
}

// ─── getModulesByCourse ───────────────────────────────────────────────────────

/**
 * Returns all modules for a course, ordered by orderIndex ascending.
 * Includes a lesson count for each module (avoids over-fetching lesson data).
 */
export async function getModulesByCourse(courseId: string) {
  return prisma.module.findMany({
    where: { courseId },
    orderBy: { orderIndex: "asc" },
    include: {
      lessons: {
        select: {
          id: true,
          title: true,
          orderIndex: true,
          moduleId: true,
        },
        orderBy: { orderIndex: "asc" },
      },
      _count: { select: { lessons: true } },
    },
  });
}

// ─── getModuleById ────────────────────────────────────────────────────────────

/**
 * Returns a single module with its lessons (ordered by orderIndex).
 * Validates that it belongs to `courseId` to prevent cross-course access.
 *
 * @throws Error if the module is not found or doesn't belong to courseId.
 */
export async function getModuleById(moduleId: string, courseId: string) {
  const mod = await prisma.module.findFirst({
    where: { id: moduleId, courseId },
    include: {
      lessons: {
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          title: true,
          orderIndex: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { materials: true } },
        },
      },
    },
  });

  if (!mod) {
    throw new Error(`Module with id "${moduleId}" not found in course "${courseId}".`);
  }

  return mod;
}

// ─── createModule ─────────────────────────────────────────────────────────────

/**
 * Creates a new module for the given course.
 * orderIndex is automatically set to (current max + 1) so new modules
 * always append to the end of the list without client involvement.
 */
export async function createModule(courseId: string, data: ModuleCreateInput) {
  // Aggregate the current max orderIndex in one query.
  const aggregate = await prisma.module.aggregate({
    where: { courseId },
    _max: { orderIndex: true },
  });
  const nextOrder = (aggregate._max.orderIndex ?? -1) + 1;

  return prisma.module.create({
    data: {
      ...data,
      courseId,
      orderIndex: nextOrder,
    },
    include: {
      _count: { select: { lessons: true } },
    },
  });
}

// ─── updateModule ─────────────────────────────────────────────────────────────

/**
 * Partial update of a module's metadata or orderIndex.
 * Verifies the module belongs to the course before updating.
 *
 * @throws Error if not found / wrong course.
 */
export async function updateModule(
  moduleId: string,
  courseId: string,
  data: ModuleUpdateInput
) {
  await assertModuleBelongsToCourse(moduleId, courseId);

  return prisma.module.update({
    where: { id: moduleId },
    data,
    include: {
      _count: { select: { lessons: true } },
    },
  });
}

// ─── deleteModule ─────────────────────────────────────────────────────────────

/**
 * Deletes a module. Prisma cascade removes all nested lessons and materials.
 *
 * @throws Error if not found / wrong course.
 */
export async function deleteModule(moduleId: string, courseId: string) {
  await assertModuleBelongsToCourse(moduleId, courseId);
  return prisma.module.delete({ where: { id: moduleId } });
}

// ─── reorderModules ───────────────────────────────────────────────────────────

/**
 * Bulk-updates the orderIndex of all modules for a course in a single
 * transaction. The client sends an ordered array of module IDs representing
 * the new desired sequence.
 *
 * @param courseId    - The parent course.
 * @param orderedIds  - Module IDs in the new desired order (index 0 → orderIndex 0).
 *
 * @throws Error if any ID in `orderedIds` doesn't belong to `courseId`.
 */
export async function reorderModules(courseId: string, orderedIds: string[]) {
  // Verify all provided IDs belong to this course.
  const existing = await prisma.module.findMany({
    where: { courseId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((m) => m.id));
  const invalid = orderedIds.filter((id) => !existingIds.has(id));
  if (invalid.length > 0) {
    throw new Error(
      `Module id(s) [${invalid.join(", ")}] do not belong to course "${courseId}".`
    );
  }

  // Write all orderIndex updates atomically.
  const updates = orderedIds.map((id, index) =>
    prisma.module.update({ where: { id }, data: { orderIndex: index } })
  );
  await prisma.$transaction(updates);

  // Return the freshly sorted list.
  return getModulesByCourse(courseId);
}
