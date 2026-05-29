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

import { useImperativeHandle, forwardRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, BookOpen, Image, FileText, Globe } from "lucide-react";
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
      {error && <p className="text-xs text-red-500 font-medium pl-1">{error}</p>}
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
      formState: { errors },
    } = useForm<CourseFormInput, unknown, CourseFormValues>({
      resolver: zodResolver(courseFormSchema),
      defaultValues: {
        title: "",
        description: "",
        thumbnailUrl: "",
        isPublished: false,
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
          aiEnabled: false,
          ...values,
        });
      },
    }));

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-7" noValidate>
        {/* ── Title ── */}
        <Field
          label="Course Title"
          icon={BookOpen}
          hint="Make it clear and descriptive. e.g. 'Introduction to Machine Learning'"
          error={errors.title?.message}
        >
          <Input
            id="course-title"
            placeholder="e.g. Introduction to Machine Learning"
            className={`rounded-xl h-11 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-sky-400 ${errors.title ? "border-red-300 focus-visible:ring-red-400" : ""
              }`}
            {...register("title")}
          />
        </Field>

        {/* ── Description ── */}
        <Field
          label="Description"
          icon={FileText}
          hint="Describe what students will learn. Markdown is supported in lesson content."
          error={errors.description?.message}
        >
          <Textarea
            id="course-description"
            placeholder="What will students learn? What are the prerequisites?"
            rows={5}
            className={`rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-sky-400 resize-y min-h-[120px] ${errors.description ? "border-red-300 focus-visible:ring-red-400" : ""
              }`}
            {...register("description")}
          />
        </Field>

        {/* ── Thumbnail URL ── */}
        <Field
          label="Thumbnail URL"
          icon={Image}
          hint="Paste a direct image URL (https://…). Leave blank for a default gradient."
          error={errors.thumbnailUrl?.message}
        >
          <Input
            id="course-thumbnail"
            type="url"
            placeholder="https://example.com/thumbnail.jpg"
            className={`rounded-xl h-11 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-sky-400 ${errors.thumbnailUrl ? "border-red-300 focus-visible:ring-red-400" : ""
              }`}
            {...register("thumbnailUrl")}
          />
        </Field>

        <Separator className="my-2" />

        {/* ── Toggles ── only shown in edit mode; create schema doesn't support it */}
        {mode === "edit" && (
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Visibility
            </p>

            {/* isPublished */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex items-start gap-3">
                <Globe size={18} className="text-sky-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Publish Course</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Published courses are visible to all students. Unpublished courses are
                    drafts.
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


            {/* aiEnabled */}

            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex items-start gap-3">
                <span className="text-lg leading-none mt-0.5">🤖</span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">AI Assistant</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enable an AI-powered Q&A assistant for enrolled students.
                  </p>
                </div>
              </div>
              <Controller
                name="aiEnabled"
                control={control}
                render={({ field }) => (
                  <Switch
                    id="course-ai-enabled"
                    checked={!!field.value}
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
            {mode === "create" ? "Create Course" : "Save Changes"}
          </Button>
          {isSubmitting && (
            <p className="text-sm text-slate-500">Saving…</p>
          )}
        </div>
      </form>
    );
  }
);

export default CourseForm;
