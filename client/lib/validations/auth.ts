/**
 * lib/validations/auth.ts
 *
 * Zod v4 validation schemas for authentication endpoints.
 * These are shared between the API route handlers (server) and can be
 * re-used on the frontend (React Hook Form + zodResolver) to avoid
 * duplicating validation logic.
 *
 * Zod v4 breaking changes from v3:
 *  - `required_error` / `invalid_type_error` → unified `error` param
 *  - `ZodError.errors` → `ZodError.issues`
 */

import { z } from "zod";

// ─── Register ────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z
    .string({ error: "Email is required." })
    .email("Please enter a valid email address.")
    .toLowerCase()
    .trim(),

  password: z
    .string({ error: "Password is required." })
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password must be at most 72 characters."), // bcrypt hard-cap

  fullName: z
    .string({ error: "Full name is required." })
    .min(2, "Full name must be at least 2 characters.")
    .max(150, "Full name must be at most 150 characters.")
    .trim(),

  role: z
    .enum(["STUDENT", "TEACHER"] as const, {
      error: 'Role must be either "STUDENT" or "TEACHER".',
    })
    .default("STUDENT"),
});

export type RegisterInput = z.input<typeof registerSchema>;
export type RegisterOutput = z.output<typeof registerSchema>;

// ─── Login ───────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z
    .string({ error: "Email is required." })
    .email("Please enter a valid email address.")
    .toLowerCase()
    .trim(),

  password: z
    .string({ error: "Password is required." })
    .min(1, "Password is required."),
});

export type LoginInput = z.infer<typeof loginSchema>;
