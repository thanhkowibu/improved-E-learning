/**
 * lib/validations/enrollment.ts
 *
 * Zod schemas for enrollment operations.
 *
 * Note: `courseId` always comes from the URL param — never the body.
 * `studentId` is always derived from the authenticated user.
 * These schemas validate any optional body fields only.
 */

import { z } from "zod";
import { EnrollmentStatus } from "@prisma/client";

// ─── Enroll (POST) ────────────────────────────────────────────────────────────
// No body fields required — courseId from URL, studentId from JWT.
// Schema kept explicit for documentation and future extension.

export const enrollSchema = z.object({}).strict();
export type EnrollInput = z.infer<typeof enrollSchema>;

// ─── Drop (DELETE) ────────────────────────────────────────────────────────────
// Also no body required, but we export the status enum values for reference.

export const DROPPABLE_STATUSES: EnrollmentStatus[] = [
  EnrollmentStatus.ACTIVE,
];

// ─── Admin status update (future extension) ───────────────────────────────────
export const enrollmentStatusSchema = z.object({
  status: z.enum(
    [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED, EnrollmentStatus.DROPPED],
    { error: "status must be ACTIVE, COMPLETED, or DROPPED." }
  ),
});
export type EnrollmentStatusInput = z.infer<typeof enrollmentStatusSchema>;
