/**
 * lib/validations/module.ts
 *
 * Zod schemas for Module create and update operations.
 *
 * Design notes:
 *  - orderIndex is NOT in courseCreateSchema — the service auto-calculates it
 *    (max existing + 1) so the client never needs to pass it on creation.
 *  - orderIndex IS in courseUpdateSchema — for explicit reorder PATCH calls.
 *  - courseId is never accepted from the body; it always comes from the URL param.
 */

import { z } from "zod";

// ─── Create ───────────────────────────────────────────────────────────────────

export const moduleCreateSchema = z
  .object({
    title: z
      .string({ error: "Title is required." })
      .min(1, "Title cannot be empty.")
      .max(255, "Title must be at most 255 characters.")
      .trim(),

    description: z
      .string({ error: "Description must be a string." })
      .max(2000, "Description must be at most 2000 characters.")
      .trim()
      .optional()
      .nullable(),
  })
  .strict();

export type ModuleCreateInput = z.infer<typeof moduleCreateSchema>;

// ─── Update (PATCH semantics — all optional) ──────────────────────────────────

export const moduleUpdateSchema = z
  .object({
    title: z
      .string({ error: "Title must be a string." })
      .min(1, "Title cannot be empty.")
      .max(255, "Title must be at most 255 characters.")
      .trim()
      .optional(),

    description: z
      .string({ error: "Description must be a string." })
      .max(2000, "Description must be at most 2000 characters.")
      .trim()
      .optional()
      .nullable(),

    orderIndex: z
      .number({ error: "orderIndex must be a number." })
      .int("orderIndex must be an integer.")
      .min(0, "orderIndex must be non-negative.")
      .optional(),
  })
  .strict();

export type ModuleUpdateInput = z.infer<typeof moduleUpdateSchema>;
