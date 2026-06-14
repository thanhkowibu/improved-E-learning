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

    phoneNumber: z
      .string({ error: "Số điện thoại không hợp lệ." })
      .max(30, "Số điện thoại tối đa 30 ký tự.")
      .trim()
      .optional()
      .nullable(),

    gender: z
      .enum(["Nam", "Nữ", "Khác"], {
        error: "Giới tính không hợp lệ.",
      })
      .optional()
      .nullable(),

    birthYear: z
      .number({ error: "Năm sinh phải là số." })
      .int("Năm sinh phải là số nguyên.")
      .min(1900, "Năm sinh không hợp lệ.")
      .max(new Date().getFullYear(), "Năm sinh không được lớn hơn năm hiện tại.")
      .optional()
      .nullable(),

    highestEducation: z
      .enum(["Cử nhân", "Thạc sĩ", "Tiến sĩ", "Khác"], {
        error: "Trình độ học vấn không hợp lệ.",
      })
      .optional()
      .nullable(),

    bio: z
      .string({ error: "Giới thiệu phải là chuỗi." })
      .max(1000, "Giới thiệu tối đa 1000 ký tự.")
      .trim()
      .optional()
      .nullable(),

    currentPassword: z
      .string({ error: "Mật khẩu hiện tại không hợp lệ." })
      .min(1, "Vui lòng nhập mật khẩu hiện tại.")
      .optional(),

    newPassword: z
      .string({ error: "Mật khẩu mới không hợp lệ." })
      .min(8, "Mật khẩu mới phải có ít nhất 8 ký tự.")
      .max(72, "Mật khẩu mới tối đa 72 ký tự.")
      .optional(),
  })
  .refine(
    (data) =>
      (!data.currentPassword && !data.newPassword) ||
      (Boolean(data.currentPassword) && Boolean(data.newPassword)),
    {
      message: "Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.",
      path: ["newPassword"],
    },
  )
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
