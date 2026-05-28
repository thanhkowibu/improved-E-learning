/**
 * lib/validations/lesson.ts
 *
 * Zod schemas for Lesson create and update operations.
 *
 * Design notes:
 *  - `content` is the rich-text / markdown body of the lesson. It is
 *    optional on create (a teacher may save a draft with just a title).
 *  - `orderIndex` is absent from createSchema — auto-calculated server-side.
 *  - `moduleId` is never accepted from the body; it always comes from the URL.
 */

import { z } from "zod";

// ─── Create ───────────────────────────────────────────────────────────────────

export const lessonCreateSchema = z
  .object({
    title: z
      .string({ error: "Title is required." })
      .min(1, "Title cannot be empty.")
      .max(255, "Title must be at most 255 characters.")
      .trim(),

    content: z
      .string({ error: "Content must be a string." })
      .max(100_000, "Content must be at most 100,000 characters.")
      .optional()
      .nullable(),
  })
  .strict();

export type LessonCreateInput = z.infer<typeof lessonCreateSchema>;

// ─── Update (PATCH semantics — all optional) ──────────────────────────────────

export const lessonUpdateSchema = z
  .object({
    title: z
      .string({ error: "Title must be a string." })
      .min(1, "Title cannot be empty.")
      .max(255, "Title must be at most 255 characters.")
      .trim()
      .optional(),

    content: z
      .string({ error: "Content must be a string." })
      .max(100_000, "Content must be at most 100,000 characters.")
      .optional()
      .nullable(),

    orderIndex: z
      .number({ error: "orderIndex must be a number." })
      .int("orderIndex must be an integer.")
      .min(0, "orderIndex must be non-negative.")
      .optional(),
  })
  .strict();

export type LessonUpdateInput = z.infer<typeof lessonUpdateSchema>;
