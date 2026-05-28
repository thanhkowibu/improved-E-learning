/**
 * lib/validations/material.ts
 *
 * Validation constants and helpers for file upload operations.
 *
 * These are shared between the storage service (size/type checks) and the
 * route handler (Zod schema for the title field in the FormData body).
 */

import { z } from "zod";
import { MaterialType } from "@prisma/client";

// ─── File constraints ─────────────────────────────────────────────────────────

/** Maximum upload size: 50 MB */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** Human-readable size limit for error messages */
export const MAX_FILE_SIZE_LABEL = "50 MB";

/**
 * MIME type → MaterialType enum mapping.
 * Only MIME types in this map are accepted. Everything else is rejected.
 */
export const ALLOWED_MIME_TYPES: Record<string, MaterialType> = {
  // Documents
  "application/pdf": MaterialType.PDF,
  "application/msword": MaterialType.OTHER,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    MaterialType.OTHER,
  "application/vnd.ms-powerpoint": MaterialType.OTHER,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    MaterialType.OTHER,
  // Video
  "video/mp4": MaterialType.VIDEO,
  "video/webm": MaterialType.VIDEO,
  "video/ogg": MaterialType.VIDEO,
  // Images
  "image/jpeg": MaterialType.OTHER,
  "image/png": MaterialType.OTHER,
  "image/gif": MaterialType.OTHER,
  "image/webp": MaterialType.OTHER,
  // Audio
  "audio/mpeg": MaterialType.OTHER,
  "audio/ogg": MaterialType.OTHER,
  "audio/wav": MaterialType.OTHER,
};

export const ALLOWED_MIME_LABELS = Object.keys(ALLOWED_MIME_TYPES).join(", ");

// ─── FormData field schema ────────────────────────────────────────────────────

/**
 * Validates the non-file fields submitted alongside the file in FormData.
 * The `file` itself is validated separately by the storage service.
 */
export const materialUploadSchema = z.object({
  /** Human-readable name shown to students. Defaults to the filename if omitted. */
  title: z
    .string({ error: "Title must be a string." })
    .min(1, "Title cannot be empty.")
    .max(255, "Title must be at most 255 characters.")
    .trim()
    .optional(),
});

export type MaterialUploadInput = z.infer<typeof materialUploadSchema>;
