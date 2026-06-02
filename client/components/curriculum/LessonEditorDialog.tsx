"use client";

/**
 * components/curriculum/LessonEditorDialog.tsx
 *
 * A Shadcn Dialog that lets a TEACHER edit a lesson's title and Markdown
 * content. Submits to PATCH /api/lessons/:lessonId.
 *
 * SSR Fix:
 *   @uiw/react-md-editor reads `window` at import time. We use next/dynamic
 *   with { ssr: false } so it is only mounted in the browser, never during
 *   server-side rendering. Wrap in data-color-mode="light" to force light theme.
 */

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApi } from "@/hooks/useApi";

// ─── Dynamic import (SSR-safe) ────────────────────────────────────────────────

/**
 * @uiw/react-md-editor accesses `window` on import, which crashes Next.js SSR.
 * next/dynamic with { ssr: false } defers the import to the client hydration
 * phase — the component never runs on the server at all.
 */
const MDEditor = dynamic(
  () => import("@uiw/react-md-editor").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 w-full rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    ),
  }
);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Lesson {
  id: string;
  title: string;
  content: string | null;
  orderIndex: number;
  moduleId: string;
}

interface FormValues {
  title: string;
  content: string;
}

interface Props {
  lesson: Lesson | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: Lesson) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LessonEditorDialog({
  lesson,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const api = useApi();
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { title: "", content: "" },
  });

  // Sync form values whenever the selected lesson changes.
  useEffect(() => {
    if (lesson) {
      reset({ title: lesson.title, content: lesson.content ?? "" });
    }
  }, [lesson, reset]);

  async function onSubmit(values: FormValues) {
    if (!lesson) return;
    setIsSaving(true);
    const toastId = toast.loading("Saving lesson…");

    const res = await api.patch<Lesson>(`/api/lessons/${lesson.id}`, {
      title: values.title.trim(),
      content: values.content || null,
    });

    if (res.success && res.data) {
      toast.success("Lesson saved.", { id: toastId });
      onSaved(res.data);
      onOpenChange(false);
    } else {
      toast.error(res.error ?? "Failed to save lesson.", { id: toastId });
    }
    setIsSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-3xl w-full max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Edit Lesson</DialogTitle>
        </DialogHeader>

        <form
          id="lesson-editor-form"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5 py-2"
        >
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="lesson-title">Lesson Title</Label>
            <Input
              id="lesson-title"
              placeholder="e.g. Introduction to Variables"
              {...register("title", { required: "Title is required." })}
              className={errors.title ? "border-red-400 focus-visible:ring-red-400" : ""}
            />
            {errors.title && (
              <p className="text-xs text-red-500">{errors.title.message}</p>
            )}
          </div>

          {/* Markdown content — SSR-safe via next/dynamic */}
          <div className="space-y-1.5">
            <Label>Lesson Content (Markdown)</Label>
            {/* data-color-mode="light" forces the editor into light mode
                regardless of the OS preference, keeping it consistent with our
                light-only theme. */}
            <div data-color-mode="light" className="rounded-lg overflow-hidden border border-slate-200">
              <Controller
                name="content"
                control={control}
                render={({ field }) => (
                  <MDEditor
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? "")}
                    height={320}
                    preview="edit"
                  />
                )}
              />
            </div>
            <p className="text-xs text-slate-400">
              Supports full Markdown syntax — headings, code blocks, lists, and more.
            </p>
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="lesson-editor-form"
            disabled={isSaving}
            className="bg-sky-500 hover:bg-sky-600 text-white gap-2"
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Lesson
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
