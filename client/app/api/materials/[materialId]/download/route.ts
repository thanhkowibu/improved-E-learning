/**
 * app/api/materials/[materialId]/download/route.ts
 *
 * GET /api/materials/:materialId/download
 *   Streams the physical file to the client with correct Content-Type
 *   and Content-Disposition headers.
 *
 *   Access: Authenticated users who have access to the lesson.
 *   (For simplicity: any authenticated user can download — enrollment
 *    gating is deferred to Phase 2E enrollment check helper.)
 *
 * Why stream via API rather than serve from /public directly?
 *   - Files in public/uploads/ are accessible without auth by default.
 *   - Routing through an API endpoint lets us enforce authentication,
 *     add download logging, apply rate limiting, and supports a future
 *     swap to S3 presigned URLs — all without changing the client URL.
 *
 * Note on Next.js body size:
 *   Large files (video) should stream. We read the file into a Buffer here
 *   for simplicity. For production video streaming, a dedicated CDN or
 *   S3 presigned URL is recommended.
 */

import { type NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { getMaterialById } from "@/lib/services/material.service";
import { resolveFilePath } from "@/lib/services/storage.service";
import { unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";

type RouteContext = { params: Promise<{ materialId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { materialId } = await context.params;

    // Require authentication for all downloads.
    const caller = await getAuthUser(request);
    void caller; // auth confirmed — enrollment gating added in Phase 2E

    // Load material + resolve ownership chain.
    const material = await getMaterialById(materialId);

    // If the parent course is unpublished, restrict to owner/ADMIN.
    const course = material.lesson.module.course;
    if (!course.isPublished) {
      const isOwner = course.teacherId === caller.id;
      const isAdmin = caller.role === "ADMIN";
      if (!isOwner && !isAdmin) {
        return notFound("Material not found or course is not yet published.");
      }
    }

    // Resolve the absolute path on disk.
    const filePath = resolveFilePath(material.fileUrl);

    // Read the file into a Buffer.
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(filePath);
    } catch (err: unknown) {
      const fsErr = err as NodeJS.ErrnoException;
      if (fsErr.code === "ENOENT") {
        return notFound("The file could not be found on the server.");
      }
      throw err;
    }

    // Derive the original filename for Content-Disposition.
    const rawFilename = path.basename(material.fileUrl);
    // Strip the UUID prefix (format: <uuid>-<original-name>)
    const displayName = rawFilename.replace(/^[0-9a-f-]{36}-/, "") || rawFilename;

    // Determine MIME type from materialType + stored URL extension.
    const ext = path.extname(rawFilename).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".pdf": "application/pdf",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".doc": "application/msword",
      ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".ppt": "application/vnd.ms-powerpoint",
      ".pptx":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".mp3": "audio/mpeg",
      ".ogg": "audio/ogg",
      ".wav": "audio/wav",
    };
    const contentType = mimeMap[ext] ?? "application/octet-stream";

    return new NextResponse(Uint8Array.from(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(displayName)}"`,
        "Content-Length": String(fileBuffer.byteLength),
        // Prevent browsers from caching private file downloads.
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[GET /api/materials/:materialId/download]", err);
    return serverError();
  }
}
