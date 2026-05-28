/**
 * app/api/materials/[materialId]/route.ts
 *
 * DELETE /api/materials/:materialId
 *   Hard-deletes a material: physical file first, then Prisma record.
 *   Access: Course owner (TEACHER) or ADMIN
 *
 * Deletion order matters:
 *   1. Delete physical file via storage.service
 *   2. Delete Prisma record via material.service
 *
 * If step 1 fails → abort entirely (record and file both safe).
 * If step 2 fails after step 1 → the file is gone but the DB record
 *   remains (orphan record, not an orphan file). This is the safer failure
 *   mode — the record can be cleaned up manually; a missing file is
 *   unrecoverable if the record was already deleted.
 */

import { type NextRequest } from "next/server";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { verifyCourseOwner } from "@/lib/auth/check-ownership";
import { getMaterialById, deleteMaterialRecord } from "@/lib/services/material.service";
import { deleteFile } from "@/lib/services/storage.service";
import {
  noContent,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api-response";

type RouteContext = { params: Promise<{ materialId: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { materialId } = await context.params;
    const caller = await getAuthUser(request);

    // One query resolves the full chain: Material → Lesson → Module → Course.
    const material = await getMaterialById(materialId);
    await verifyCourseOwner(caller, material.lesson.module.courseId);

    // Step 1: delete the physical file (storage adapter).
    await deleteFile(material.fileUrl);

    // Step 2: delete the database record.
    await deleteMaterialRecord(materialId);

    return noContent();
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[DELETE /api/materials/:materialId]", err);
    return serverError();
  }
}
