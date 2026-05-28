/**
 * lib/validations/user.ts
 *
 * Zod schemas for user-facing update operations.
 *
 * Key design decisions:
 *  - fullName / avatarUrl may be changed by the user themselves or an ADMIN.
 *  - isActive is an ADMIN-only field (soft-enable / soft-disable accounts).
 *    We split the schema into two so each route handler uses the narrowest
 *    allowed shape, preventing privilege escalation via the API body.
 *  - All fields are optional (partial update / PATCH semantics).
 *  - We use .strict() so unknown keys are rejected — avoids mass-assignment.
 */

import { z } from "zod";

// ─── Self-update (user or ADMIN) ─────────────────────────────────────────────

export const userSelfUpdateSchema = z
  .object({
    fullName: z
      .string({ error: "Full name must be a string." })
      .min(2, "Full name must be at least 2 characters.")
      .max(150, "Full name must be at most 150 characters.")
      .trim()
      .optional(),

    avatarUrl: z
      .string({ error: "Avatar URL must be a string." })
      .url("Avatar URL must be a valid URL.")
      .optional()
      .nullable(), // allow explicitly clearing the avatar
  })
  .strict();

export type UserSelfUpdateInput = z.infer<typeof userSelfUpdateSchema>;

// ─── ADMIN update (superset of self-update) ──────────────────────────────────

export const userAdminUpdateSchema = userSelfUpdateSchema
  .extend({
    isActive: z
      .boolean({ error: "isActive must be a boolean." })
      .optional(),
  })
  .strict();

export type UserAdminUpdateInput = z.infer<typeof userAdminUpdateSchema>;
