/**
 * app/api/lessons/[lessonId]/materials/upload/route.ts
 *
 * POST /api/lessons/:lessonId/materials/upload
 *   Accepts multipart/form-data with:
 *     - file:  File  (required) — the binary upload
 *     - title: string (optional) — display name (defaults to filename)
 *
 *   Access: Course owner (TEACHER) or ADMIN
 *
 * Flow:
 *   1. Auth + ownership check (Lesson → Module → Course)
 *   2. Parse FormData via native request.formData() (NO multer)
 *   3. Validate file via storage.service (MIME + size)
 *   4. Save to disk via storage.service.uploadFile()
 *   5. Create Prisma record via material.service.createMaterial()
 *   6. Return the new material record
 *
 * If the DB insert fails after the file is saved, we delete the orphan file.
 */

import { type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { verifyCourseOwner } from "@/lib/auth/check-ownership";
import { getLessonById } from "@/lib/services/lesson.service";
import { materialUploadSchema } from "@/lib/validations/material";
import { uploadFile, deleteFile } from "@/lib/services/storage.service";
import { createMaterial } from "@/lib/services/material.service";
import {
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api-response";

type RouteContext = { params: Promise<{ lessonId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { lessonId } = await context.params;
    const caller = await getAuthUser(request);

    // 1. Resolve ownership chain: Lesson → Module → Course.
    const lesson = await getLessonById(lessonId);
    await verifyCourseOwner(caller, lesson.module.courseId);

    // 2. Parse the multipart form data using native Web API.
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return badRequest("Request must be multipart/form-data.");
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return badRequest('A "file" field is required in the form data.');
    }

    // 3. Validate the optional title field.
    const rawTitle = formData.get("title");
    let title: string;
    try {
      const parsed = materialUploadSchema.parse({
        title: typeof rawTitle === "string" ? rawTitle : undefined,
      });
      // Default title falls back to the original filename (stripped of UUID prefix).
      title = parsed.title ?? file.name;
    } catch (err) {
      if (err instanceof ZodError) {
        return badRequest("Validation failed.", err.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })));
      }
      throw err;
    }

    // 4. Save the file (validates MIME + size, writes to disk).
    let uploadResult: Awaited<ReturnType<typeof uploadFile>>;
    try {
      uploadResult = await uploadFile(file, lessonId);
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : "File upload failed.");
    }

    // 5. Create the database record.
    //    If this fails, clean up the orphaned file to keep storage consistent.
    let material: Awaited<ReturnType<typeof createMaterial>>;
    try {
      material = await createMaterial({
        lessonId,
        title,
        materialType: uploadResult.materialType,
        fileUrl: uploadResult.fileUrl,
        fileSizeBytes: uploadResult.fileSizeBytes,
      });
    } catch (dbErr) {
      // Best-effort cleanup — log but don't rethrow the deletion error.
      await deleteFile(uploadResult.fileUrl).catch((e) =>
        console.error("[upload] Orphan file cleanup failed:", e)
      );
      throw dbErr;
    }

    return created(material, "Material uploaded successfully.");
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[POST /api/lessons/:lessonId/materials/upload]", err);
    return serverError();
  }
}
