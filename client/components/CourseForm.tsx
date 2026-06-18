"use client";

/**
 * components/CourseForm.tsx
 *
 * Reusable form for both Course Create and Course Edit.
 *
 * Key fixes:
 *  - CourseForm no longer drives its own defaultValues reset.
 *    Instead, it exposes a `resetRef` so the parent can call reset()
 *    with fresh data after a successful PATCH — following react-hook-form's
 *    official pattern for imperative resets.
 *  - The `aiEnabled` field is excluded from the create payload because the
 *    server's courseCreateSchema (strict) does not include it.
 *  - `thumbnailUrl` empty-string → undefined before submission so it passes
 *    the server's optional URL validation.
 */

import { useEffect, useImperativeHandle, forwardRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  BookOpen,
  Image,
  FileText,
  Globe,
  Bot,
  LockKeyhole,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

// ─── Client-safe Zod schema ───────────────────────────────────────────────────
// Covers the superset of create + update fields.
// The parent page strips fields that don't belong to the specific operation.

const courseFormSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters.")
    .max(255, "Title must be at most 255 characters.")
    .trim(),
  description: z
    .string()
    .max(5000, "Description must be at most 5000 characters.")
    .trim()
    .optional(),
  // Empty string is valid as "clear the field"; normalized to undefined before submit.
  thumbnailUrl: z
    .union([z.string().url("Must be a valid URL (https://…)"), z.literal("")])
    .optional(),
  isPublished: z.boolean().default(false),
  isPrivate: z.boolean().default(false),
  aiEnabled: z.boolean().default(false),
});

// Output type (after Zod transforms / defaults)
export type CourseFormValues = z.infer<typeof courseFormSchema>;
// Input type (before defaults — booleans may still be `undefined` from the form)
type CourseFormInput = z.input<typeof courseFormSchema>;

// ─── Imperative handle — lets the parent call reset() ────────────────────────

export interface CourseFormHandle {
  reset: (values: Partial<CourseFormValues>) => void;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CourseFormProps {
  mode: "create" | "edit";
  defaultValues?: Partial<CourseFormValues>;
  onSubmit: (values: CourseFormValues) => Promise<void>;
  isSubmitting: boolean;
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  error,
  icon: Icon,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={15} className="text-slate-400 shrink-0" />}
        <Label className="text-sm font-semibold text-slate-800">{label}</Label>
      </div>
      {children}
      {hint && !error && <p className="text-xs text-slate-400 pl-1">{hint}</p>}
      {error && (
        <p className="text-xs text-red-500 font-medium pl-1">{error}</p>
      )}
    </div>
  );
}

// ─── CourseForm ───────────────────────────────────────────────────────────────

const CourseForm = forwardRef<CourseFormHandle, CourseFormProps>(
  function CourseForm({ mode, defaultValues, onSubmit, isSubmitting }, ref) {
    const {
      register,
      handleSubmit,
      control,
      reset,
      setValue,
      watch,
      formState: { errors },
    } = useForm<CourseFormInput, unknown, CourseFormValues>({
      resolver: zodResolver(courseFormSchema),
      defaultValues: {
        title: "",
        description: "",
        thumbnailUrl: "",
        isPublished: false,
        isPrivate: false,
        aiEnabled: false,
        ...defaultValues,
      },
    });

    // Expose reset() so EditCoursePage can call formRef.current.reset(savedData)
    // after a successful PATCH — the react-hook-form canonical approach.
    useImperativeHandle(ref, () => ({
      reset(values) {
        reset({
          title: "",
          description: "",
          thumbnailUrl: "",
          isPublished: false,
          isPrivate: false,
          aiEnabled: false,
          ...values,
        });
      },
    }));

    const watchedAiEnabled = watch("aiEnabled");
    const watchedIsPrivate = watch("isPrivate");

    useEffect(() => {
      if (mode !== "edit" || typeof defaultValues?.aiEnabled !== "boolean") {
        return;
      }

      setValue("aiEnabled", defaultValues.aiEnabled, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    }, [defaultValues?.aiEnabled, mode, setValue]);

    useEffect(() => {
      if (mode !== "edit" || typeof defaultValues?.isPrivate !== "boolean") {
        return;
      }

      setValue("isPrivate", defaultValues.isPrivate, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    }, [defaultValues?.isPrivate, mode, setValue]);

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-7" noValidate>
        {/* ── Title ── */}
        <Field
          label="Tên khóa học"
          icon={BookOpen}
          hint="Đặt tên rõ ràng, dễ hiểu. Ví dụ: 'Nhập môn học máy'"
          error={errors.title?.message}
        >
          <Input
            id="course-title"
            placeholder="Ví dụ: Nhập môn học máy"
            className={`rounded-xl h-11 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-sky-400 ${
              errors.title ? "border-red-300 focus-visible:ring-red-400" : ""
            }`}
            {...register("title")}
          />
        </Field>

        {/* ── Description ── */}
        <Field
          label="Mô tả"
          icon={FileText}
          hint="Mô tả những gì sinh viên sẽ học. Nội dung bài học có hỗ trợ Markdown."
          error={errors.description?.message}
        >
          <Textarea
            id="course-description"
            placeholder="Sinh viên sẽ học gì? Cần kiến thức nền nào?"
            rows={5}
            className={`rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-sky-400 resize-y min-h-30 ${
              errors.description
                ? "border-red-300 focus-visible:ring-red-400"
                : ""
            }`}
            {...register("description")}
          />
        </Field>

        {/* ── Thumbnail URL ── */}
        <Field
          label="Thumbnail URL"
          icon={Image}
          hint="Dán URL hình ảnh trực tiếp (https://…). Để trống sẽ có gradient mặc định."
          error={errors.thumbnailUrl?.message}
        >
          <Input
            id="course-thumbnail"
            type="url"
            placeholder="https://example.com/thumbnail.jpg"
            className={`rounded-xl h-11 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-sky-400 ${
              errors.thumbnailUrl
                ? "border-red-300 focus-visible:ring-red-400"
                : ""
            }`}
            {...register("thumbnailUrl")}
          />
        </Field>

        <Separator className="my-2" />

        {/* ── Toggles ── only shown in edit mode; create schema doesn't support it */}
        {mode === "edit" && (
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Hiển thị
            </p>

            {/* isPublished */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex items-start gap-3">
                <Globe size={18} className="text-sky-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Xuất bản khóa học
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Khóa học đã xuất bản sẽ hiển thị với sinh viên. Khóa học
                    chưa xuất bản được lưu dưới dạng <br /> bản nháp.
                  </p>
                </div>
              </div>
              <Controller
                name="isPublished"
                control={control}
                render={({ field }) => (
                  <Switch
                    id="course-published"
                    checked={!!field.value}
                    onCheckedChange={field.onChange}
                    className="data-[state=checked]:bg-sky-500"
                  />
                )}
              />
            </div>

            {/* isPrivate */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex items-start gap-3">
                <LockKeyhole
                  size={18}
                  className="text-sky-500 mt-0.5 shrink-0"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Khóa học Nội bộ (Chỉ Giảng viên mới được thêm sinh viên)
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Khi bật, sinh viên không thể tự do đăng ký hoặc hủy đăng ký
                    khóa học này.
                  </p>
                </div>
              </div>
              <Controller
                name="isPrivate"
                control={control}
                render={({ field }) => (
                  <Switch
                    id="course-private"
                    checked={!!watchedIsPrivate}
                    onCheckedChange={field.onChange}
                    className="data-[state=checked]:bg-sky-500"
                  />
                )}
              />
            </div>

            {/* aiEnabled */}

            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex items-start gap-3">
                <Bot className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Trợ giảng AI
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Bật tính năng trợ lý hỏi đáp AI cho sinh viên đã đăng ký.
                  </p>
                </div>
              </div>
              <Controller
                name="aiEnabled"
                control={control}
                render={({ field }) => (
                  <Switch
                    id="course-ai-enabled"
                    checked={!!watchedAiEnabled}
                    onCheckedChange={field.onChange}
                    className="data-[state=checked]:bg-violet-500"
                  />
                )}
              />
            </div>
          </div>
        )}

        {/* ── Submit ── */}
        <div className="pt-2 flex items-center gap-3">
          <Button
            id="course-form-submit"
            type="submit"
            disabled={isSubmitting}
            className="bg-sky-500 hover:bg-sky-600 text-white rounded-xl px-8 py-2.5 font-semibold gap-2 shadow-sm transition-all"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            {mode === "create" ? "Tạo khóa học" : "Lưu thay đổi"}
          </Button>
          {isSubmitting && <p className="text-sm text-slate-500">Đang lưu…</p>}
        </div>
      </form>
    );
  },
);

export default CourseForm;
