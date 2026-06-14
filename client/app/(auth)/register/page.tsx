"use client";

/**
 * app/(auth)/register/page.tsx
 *
 * Registration page.
 * Adapted from reference layout with our branding + required Role dropdown.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  registerSchema,
  type RegisterInput,
  type RegisterOutput,
} from "@/lib/validations/auth";
import { useAuth } from "@/hooks/useAuth";

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700">
        {label}
        {hint && (
          <span className="ml-1 text-slate-400 font-normal">{hint}</span>
        )}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-3.5 w-3.5 shrink-0"
          >
            <path
              fillRule="evenodd"
              d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm0-4a.75.75 0 0 1-.75-.75v-2.5a.75.75 0 0 1 1.5 0v2.5A.75.75 0 0 1 8 11Zm0-5.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 " +
  "focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-shadow";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterOutput>({
    resolver: zodResolver(
      registerSchema,
    ) as import("react-hook-form").Resolver<RegisterOutput>,
    defaultValues: { role: "STUDENT" },
  });

  const selectedRole = watch("role");

  async function onSubmit(data: RegisterOutput) {
    setServerError(null);
    const toastId = toast.loading("Đang tạo tài khoản...");
    try {
      await registerUser(data);
      toast.success("Tạo tài khoản thành công!", { id: toastId });
      router.push("/courses");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đăng ký thất bại.";
      setServerError(msg);
      toast.error(msg, { id: toastId });
    }
  }

  return (
    <div className="space-y-7">
      {/* Heading */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Tạo tài khoản</h1>
        <p className="text-sm text-slate-500">
          Bắt đầu học ngay hôm nay, hoàn toàn miễn phí
        </p>
      </div>

      {/* Server error banner */}
      {serverError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-5 w-5 shrink-0 text-red-400 mt-0.5"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-.75-4.75a.75.75 0 0 0 1.5 0v-2.5a.75.75 0 0 0-1.5 0v2.5Zm.75-7a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
              clipRule="evenodd"
            />
          </svg>
          {serverError}
        </div>
      )}

      {/* Form */}
      <form
        id="register-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="space-y-5"
      >
        {/* Full name */}
        <Field label="Họ và tên" error={errors.fullName?.message}>
          <input
            id="register-fullname"
            type="text"
            autoComplete="name"
            placeholder="Nguyễn Văn A"
            className={inputCls}
            {...register("fullName")}
          />
        </Field>

        {/* Email */}
        <Field label="Địa chỉ email" error={errors.email?.message}>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={inputCls}
            {...register("email")}
          />
        </Field>

        {/* Password */}
        <Field
          label="Mật khẩu"
          hint="(tối thiểu 8 ký tự)"
          error={errors.password?.message}
        >
          <div className="relative">
            <input
              id="register-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              className={`${inputCls} pr-11`}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showPassword ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.091 1.092a4 4 0 0 0-5.557-5.557Z"
                    clipRule="evenodd"
                  />
                  <path d="m10.748 13.93 2.523 2.523a9.987 9.987 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 0 1 0-1.186A10.007 10.007 0 0 1 2.839 6.02L6.07 9.252a4 4 0 0 0 4.678 4.678Z" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                >
                  <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                  <path
                    fillRule="evenodd"
                    d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41Z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          </div>
        </Field>

        {/* Role selector — custom card toggle */}
        <Field label="Tôi là..." error={errors.role?.message}>
          <div className="grid grid-cols-2 gap-3">
            {(["STUDENT", "TEACHER"] as const).map((role) => {
              const active = selectedRole === role;
              const icons = {
                STUDENT: (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-5 w-5"
                  >
                    <path d="M10.394 2.08a1 1 0 0 0-.788 0l-7 3a1 1 0 0 0 0 1.84L5.25 8.051a.999.999 0 0 1 .356-.257l4-1.714a1 1 0 1 1 .788 1.838L7.667 9.088l1.94.831a1 1 0 0 0 .787 0l7-3a1 1 0 0 0 0-1.838l-7-3ZM3.31 9.397 5 10.12v4.102a8.969 8.969 0 0 0-1.05-.174 1 1 0 0 1-.89-.89 11.115 11.115 0 0 1 .25-3.762Zm5.99 7.176A9.026 9.026 0 0 0 7 14.935v-3.957l1.818.78a3 3 0 0 0 2.364 0l5.508-2.361a11.026 11.026 0 0 1 .25 3.762 1 1 0 0 1-.89.89 8.968 8.968 0 0 0-5.35 2.524 1 1 0 0 1-1.4 0ZM6 18a1 1 0 0 0 1-1v-2.065a8.935 8.935 0 0 0-2-.712V17a1 1 0 0 0 1 1Z" />
                  </svg>
                ),
                TEACHER: (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-5 w-5"
                  >
                    <path d="M13 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM18 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 15a4 4 0 0 0-8 0v3h8v-3ZM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM16 15a2 2 0 0 0-2-2 5.978 5.978 0 0 1-1.75.26V15h3.75ZM4 15h3.75v-1.74A5.978 5.978 0 0 1 6 13a2 2 0 0 0-2 2v0Z" />
                  </svg>
                ),
              };
              return (
                <label
                  key={role}
                  htmlFor={`register-role-${role}`}
                  className={`flex items-center gap-3 p-3.5 rounded-lg border-2 cursor-pointer transition-all ${
                    active
                      ? "border-sky-500 bg-sky-50 text-sky-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    id={`register-role-${role}`}
                    value={role}
                    className="sr-only"
                    {...register("role")}
                  />
                  <span className={active ? "text-sky-500" : "text-slate-400"}>
                    {icons[role]}
                  </span>
                  <div>
                    <p className="text-sm font-semibold leading-none">
                      {role === "STUDENT" ? "Sinh viên" : "Giảng viên"}
                    </p>
                    <p className="text-xs mt-0.5 text-slate-400">
                      {role === "STUDENT"
                        ? "Tôi muốn học"
                        : "Tôi muốn giảng dạy"}
                    </p>
                  </div>
                  {active && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-4 w-4 text-sky-500 ml-auto shrink-0"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </label>
              );
            })}
          </div>
        </Field>

        {/* Submit */}
        <button
          id="register-submit-btn"
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-semibold text-white bg-sky-500 hover:bg-sky-600 active:bg-sky-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {isSubmitting ? (
            <>
              <svg
                className="animate-spin h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Đang tạo tài khoản...
            </>
          ) : (
            "Tạo tài khoản"
          )}
        </button>
      </form>

      {/* Sign-in link */}
      <p className="text-center text-sm text-slate-500">
        Đã có tài khoản?{" "}
        <Link
          id="register-login-link"
          href="/login"
          className="font-medium text-sky-600 hover:text-sky-700 underline underline-offset-2"
        >
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
