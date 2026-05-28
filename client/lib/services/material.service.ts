/**
 * lib/services/material.service.ts
 *
 * Prisma record operations for the Material model.
 *
 * This service handles ONLY the database layer.
 * Physical file I/O is handled exclusively by storage.service.ts.
 * Route handlers orchestrate both services — never directly.
 */

import prisma from "@/lib/prisma";
import type { MaterialType } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateMaterialData {
  lessonId: string;
  title: string;
  materialType: MaterialType;
  fileUrl: string;
  fileSizeBytes: bigint;
}

// ─── getMaterialsByLesson ─────────────────────────────────────────────────────

/**
 * Returns all materials for a lesson, ordered by creation date ascending.
 */
export async function getMaterialsByLesson(lessonId: string) {
  return prisma.material.findMany({
    where: { lessonId },
    orderBy: { createdAt: "asc" },
  });
}

// ─── getMaterialById ──────────────────────────────────────────────────────────

/**
 * Returns a single material, including the lesson → module → course chain
 * so route handlers can resolve ownership without extra queries.
 *
 * @throws Error if not found.
 */
export async function getMaterialById(materialId: string) {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    include: {
      lesson: {
        select: {
          id: true,
          moduleId: true,
          module: {
            select: {
              id: true,
              courseId: true,
              course: {
                select: { id: true, teacherId: true, isPublished: true },
              },
            },
          },
        },
      },
    },
  });

  if (!material) {
    throw new Error(`Material with id "${materialId}" not found.`);
  }

  return material;
}

// ─── createMaterial ───────────────────────────────────────────────────────────

/**
 * Persists a new material record in the database.
 * The calling route handler must have already saved the file via storage.service.
 */
export async function createMaterial(data: CreateMaterialData) {
  return prisma.material.create({
    data: {
      lessonId: data.lessonId,
      title: data.title,
      materialType: data.materialType,
      fileUrl: data.fileUrl,
      fileSizeBytes: data.fileSizeBytes,
    },
  });
}

// ─── deleteMaterialRecord ─────────────────────────────────────────────────────

/**
 * Deletes the Prisma record for a material.
 * The calling route handler must also delete the physical file via storage.service.
 *
 * @throws Error if not found.
 */
export async function deleteMaterialRecord(materialId: string) {
  const exists = await prisma.material.findUnique({
    where: { id: materialId },
    select: { id: true },
  });
  if (!exists) {
    throw new Error(`Material with id "${materialId}" not found.`);
  }
  return prisma.material.delete({ where: { id: materialId } });
}
