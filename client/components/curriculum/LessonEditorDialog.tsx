"use client";

/**
 * components/curriculum/LessonEditorDialog.tsx
 *
 * A Shadcn Dialog split into two tabs:
 *   "Content"   — lesson title + Markdown editor (existing)
 *   "Materials" — file upload zone + material list (new LessonMaterials)
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
import { Loader2, FileText, BookOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApi } from "@/hooks/useApi";
import LessonMaterials from "./LessonMaterials";

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
  content?: string | null;
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
  // Reset to "content" tab each time a new lesson is opened.
  const [activeTab, setActiveTab] = useState("content");
  const [editorRevision, setEditorRevision] = useState(0);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { title: "", content: "" },
  });

  // Sync form values whenever the dialog opens. The module list deliberately
  // omits lesson.content, so fetch the full lesson before hydrating the editor.
  useEffect(() => {
    if (!open) return;

    if (!lesson) {
      reset({ title: "", content: "" });
      setActiveTab("content");
      return;
    }

    let isCancelled = false;

    function applyFormValues(nextLesson: Lesson) {
      const nextValues = {
        title: nextLesson.title,
        content: nextLesson.content ?? "",
      };

      reset(nextValues);
      setValue("title", nextValues.title, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
      setValue("content", nextValues.content, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
      setEditorRevision((revision) => revision + 1);
    }

    const selectedLesson = lesson;

    applyFormValues(selectedLesson);
    setActiveTab("content");

    async function loadFullLesson() {
      const res = await api.get<Lesson>(`/api/lessons/${selectedLesson.id}`);
      if (isCancelled) return;

      if (res.success && res.data) {
        applyFormValues(res.data);
      } else {
        toast.error(res.error ?? res.message ?? "Failed to load lesson content.");
      }
    }

    void loadFullLesson();

    return () => {
      isCancelled = true;
    };
    // api is intentionally omitted because useApi returns a new object in some renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lesson?.id, reset, setValue]);

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
      <DialogContent className="sm:max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="truncate max-w-lg">
            {lesson?.title ?? "Edit Lesson"}
          </DialogTitle>
        </DialogHeader>

        {/* ── Tabs ── */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 overflow-hidden flex flex-col min-h-0"
        >
          <TabsList className="shrink-0 w-fit">
            <TabsTrigger value="content" className="gap-1.5">
              <BookOpen size={13} />
              Content
            </TabsTrigger>
            <TabsTrigger value="materials" className="gap-1.5">
              <FileText size={13} />
              Materials
            </TabsTrigger>
          </TabsList>

          {/* ── Content Tab ── */}
          <TabsContent
            value="content"
            className="flex-1 overflow-y-auto mt-0 pt-2"
          >
            <form
              id="lesson-editor-form"
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-5"
            >
              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="lesson-title">Lesson Title</Label>
                <Input
                  id="lesson-title"
                  placeholder="e.g. Introduction to Variables"
                  {...register("title", { required: "Title is required." })}
                  className={
                    errors.title
                      ? "border-red-400 focus-visible:ring-red-400"
                      : ""
                  }
                />
                {errors.title && (
                  <p className="text-xs text-red-500">{errors.title.message}</p>
                )}
              </div>

              {/* Markdown content — SSR-safe via next/dynamic */}
              <div className="space-y-1.5">
                <Label>Lesson Content (Markdown)</Label>
                {/*
                 * data-color-mode="light" forces the editor into light mode
                 * regardless of the OS preference, keeping it consistent with
                 * our light-only theme.
                 */}
                <div
                  data-color-mode="light"
                  className="rounded-lg overflow-hidden border border-slate-200"
                >
                  <Controller
                    name="content"
                    control={control}
                    render={({ field }) => (
                      <MDEditor
                        key={`${lesson?.id ?? "lesson"}-${editorRevision}`}
                        value={field.value}
                        onChange={(v) => field.onChange(v ?? "")}
                        height={320}
                        preview="edit"
                      />
                    )}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Supports full Markdown syntax — headings, code blocks, lists,
                  and more.
                </p>
              </div>
            </form>
          </TabsContent>

          {/* ── Materials Tab ── */}
          <TabsContent
            value="materials"
            className="flex-1 overflow-y-auto mt-0 pt-2"
          >
            {lesson ? (
              <LessonMaterials lessonId={lesson.id} />
            ) : (
              <p className="text-sm text-slate-400 text-center py-8">
                No lesson selected.
              </p>
            )}
          </TabsContent>
        </Tabs>

        {/* ── Footer — only shown on Content tab ── */}
        {activeTab === "content" && (
          <DialogFooter className="shrink-0 border-t border-slate-100 pt-4 mt-2">
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
        )}
      </DialogContent>
    </Dialog>
  );
}
