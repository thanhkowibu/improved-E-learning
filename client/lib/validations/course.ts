/**
 * lib/validations/course.ts
 *
 * Zod schemas for Course create and update operations.
 *
 * Design notes:
 *  - courseCreateSchema: `title` is required; all other fields optional.
 *  - courseUpdateSchema: full partial of courseCreateSchema — every field
 *    optional for PATCH semantics. Uses .strict() to reject unknown keys.
 *  - `teacherId` is intentionally NOT in either schema — it is always
 *    derived from the authenticated user on the server, never from the body.
 */

import { z } from "zod";

// ─── Create ───────────────────────────────────────────────────────────────────

export const courseCreateSchema = z
  .object({
    title: z
      .string({ error: "Title is required." })
      .min(3, "Title must be at least 3 characters.")
      .max(255, "Title must be at most 255 characters.")
      .trim(),

    description: z
      .string({ error: "Description must be a string." })
      .max(5000, "Description must be at most 5000 characters.")
      .trim()
      .optional()
      .nullable(),

    thumbnailUrl: z
      .string({ error: "Thumbnail URL must be a string." })
      .url("Thumbnail URL must be a valid URL.")
      .optional()
      .nullable(),

    isPublished: z
      .boolean({ error: "isPublished must be a boolean." })
      .optional()
      .default(false),
  })
  .strict();

export type CourseCreateInput = z.infer<typeof courseCreateSchema>;

// ─── Update (full partial — PATCH semantics) ──────────────────────────────────

export const courseUpdateSchema = z
  .object({
    title: z
      .string({ error: "Title must be a string." })
      .min(3, "Title must be at least 3 characters.")
      .max(255, "Title must be at most 255 characters.")
      .trim()
      .optional(),

    description: z
      .string({ error: "Description must be a string." })
      .max(5000, "Description must be at most 5000 characters.")
      .trim()
      .optional()
      .nullable(),

    thumbnailUrl: z
      .string({ error: "Thumbnail URL must be a string." })
      .url("Thumbnail URL must be a valid URL.")
      .optional()
      .nullable(),

    isPublished: z
      .boolean({ error: "isPublished must be a boolean." })
      .optional(),

    isPrivate: z
      .boolean({ error: "isPrivate must be a boolean." })
      .optional(),

    aiEnabled: z
      .boolean({ error: "aiEnabled must be a boolean." })
      .optional(),
  })
  .strict();

export type CourseUpdateInput = z.infer<typeof courseUpdateSchema>;
