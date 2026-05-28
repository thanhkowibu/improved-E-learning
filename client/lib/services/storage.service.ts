/**
 * lib/services/storage.service.ts
 *
 * Storage Adapter — abstracts all file I/O behind two functions.
 *
 * Current implementation: local filesystem under public/uploads/
 * Future swap: replace function bodies with AWS S3 SDK calls,
 * returning the same string URL — zero changes to callers.
 *
 * Why this matters:
 *   - Route handlers NEVER import `fs` directly.
 *   - Swapping storage backends requires editing only this one file.
 *   - The public URL format (/uploads/<lessonId>/<filename>) is stable
 *     regardless of the underlying storage mechanism.
 *
 * File layout:  <cwd>/public/uploads/<lessonId>/<uuid>-<sanitised-name>
 * Public URL:   /uploads/<lessonId>/<uuid>-<sanitised-name>
 */

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import {
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_LABEL,
  ALLOWED_MIME_TYPES,
} from "@/lib/validations/material";
import type { MaterialType } from "@prisma/client";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Absolute path to the uploads root inside the Next.js public directory. */
const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadResult {
  /** Publicly accessible URL, e.g. /uploads/<lessonId>/<filename> */
  fileUrl: string;
  /** Resolved MaterialType enum from the file's MIME type */
  materialType: MaterialType;
  /** Exact byte size of the uploaded file */
  fileSizeBytes: bigint;
  /** Original (sanitised) filename stored on disk */
  fileName: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Strips characters that are unsafe for filenames across OS platforms.
 * Keeps alphanumerics, hyphens, underscores, and dots.
 */
function sanitiseFilename(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")    // remove accent diacritics
    .replace(/[^a-zA-Z0-9._-]/g, "_")  // replace unsafe chars
    .replace(/_{2,}/g, "_")             // collapse repeated underscores
    .slice(0, 200);                      // cap total length
}

// ─── uploadFile ───────────────────────────────────────────────────────────────

/**
 * Validates, saves, and returns metadata for an uploaded File object.
 *
 * Validation (throws Error on failure):
 *  - MIME type must be in ALLOWED_MIME_TYPES
 *  - File size must not exceed MAX_FILE_SIZE_BYTES
 *
 * Storage path: public/uploads/<lessonId>/<uuid>-<sanitised-filename>
 *
 * @param file      - The Web API `File` object from `request.formData()`.
 * @param lessonId  - Used to namespace uploads per lesson (avoids collisions).
 */
export async function uploadFile(
  file: File,
  lessonId: string
): Promise<UploadResult> {
  // 1. Validate MIME type.
  const materialType = ALLOWED_MIME_TYPES[file.type];
  if (!materialType) {
    throw new Error(
      `File type "${file.type}" is not allowed. ` +
        `Accepted types: PDF, MP4, WEBM, DOCX, PPTX, images, audio.`
    );
  }

  // 2. Validate file size.
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File exceeds the maximum allowed size of ${MAX_FILE_SIZE_LABEL}.`
    );
  }

  // 3. Build a collision-safe filename.
  const safeOriginal = sanitiseFilename(file.name || "upload");
  const uniqueName = `${randomUUID()}-${safeOriginal}`;

  // 4. Ensure the target directory exists.
  const lessonDir = path.join(UPLOADS_ROOT, lessonId);
  await fs.mkdir(lessonDir, { recursive: true });

  // 5. Write the file using Node.js fs/promises (no multer, no middleware).
  const destPath = path.join(lessonDir, uniqueName);
  const arrayBuffer = await file.arrayBuffer();
  await fs.writeFile(destPath, Buffer.from(arrayBuffer));

  return {
    fileUrl: `/uploads/${lessonId}/${uniqueName}`,
    materialType,
    fileSizeBytes: BigInt(file.size),
    fileName: uniqueName,
  };
}

// ─── deleteFile ───────────────────────────────────────────────────────────────

/**
 * Physically removes a file from disk given its public URL.
 *
 * The URL is resolved back to an absolute filesystem path by replacing
 * the leading `/uploads/` prefix with the UPLOADS_ROOT.
 *
 * Silently succeeds if the file doesn't exist (idempotent delete).
 * Only deletes files within UPLOADS_ROOT to prevent path traversal.
 *
 * @param fileUrl - The value stored in Material.fileUrl (e.g. "/uploads/...").
 */
export async function deleteFile(fileUrl: string): Promise<void> {
  if (!fileUrl.startsWith("/uploads/")) {
    // Safety guard: only touch files we put there.
    console.warn(`[storage.service] Skipping delete — unexpected path: ${fileUrl}`);
    return;
  }

  const relativePath = fileUrl.replace(/^\/uploads\//, "");
  const absolutePath = path.join(UPLOADS_ROOT, relativePath);

  // Ensure the resolved path is still inside UPLOADS_ROOT (path traversal guard).
  if (!absolutePath.startsWith(UPLOADS_ROOT)) {
    throw new Error("Path traversal attempt detected in deleteFile.");
  }

  try {
    await fs.unlink(absolutePath);
  } catch (err: unknown) {
    // ENOENT = file already gone — treat as success (idempotent).
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw err;
  }
}

// ─── readFileStream ───────────────────────────────────────────────────────────

/**
 * Returns the absolute filesystem path for a file URL.
 * Used by the download route to read the file for streaming.
 *
 * @throws Error if the URL format is unexpected (security guard).
 */
export function resolveFilePath(fileUrl: string): string {
  if (!fileUrl.startsWith("/uploads/")) {
    throw new Error(`Cannot resolve path for URL: ${fileUrl}`);
  }
  const relativePath = fileUrl.replace(/^\/uploads\//, "");
  const absolutePath = path.join(UPLOADS_ROOT, relativePath);

  if (!absolutePath.startsWith(UPLOADS_ROOT)) {
    throw new Error("Path traversal attempt detected in resolveFilePath.");
  }
  return absolutePath;
}
