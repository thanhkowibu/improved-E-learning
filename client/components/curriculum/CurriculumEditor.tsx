"use client";

/**
 * components/curriculum/CurriculumEditor.tsx
 *
 * The main Curriculum Editor — rendered below the CourseForm on the Edit page.
 *
 * Architecture decisions:
 *   1. STATE DECOUPLED FROM CourseForm — this component fetches its own data
 *      via GET /api/courses/:courseId/modules and manages its own module/lesson
 *      state. Keeps CourseForm's react-hook-form state isolated; changes to the
 *      curriculum do NOT trigger a form-level re-render. (See ADR-008)
 *
 *   2. DND FOR MODULES ONLY — @dnd-kit/core + @dnd-kit/sortable handles drag-
 *      and-drop reordering of modules. After a drag-end, we call
 *      PUT /api/courses/:courseId/modules with the new orderedIds array.
 *      Lesson reordering uses Up/Down arrow buttons inside ModuleItem to avoid
 *      the complexity and crash-potential of nested DND contexts.
 *
 *   3. OPTIMISTIC UI — module order is updated locally before the API call
 *      completes. On failure, the original order is restored.
 *
 *   4. LESSON EDITOR — clicking the ✏️ icon on a lesson opens
 *      LessonEditorDialog, which contains the (SSR-safe) Markdown editor.
 */

import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { toast } from "sonner";
import { Plus, Loader2, BookOpen, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/useApi";
import ModuleItem, { type Module } from "./ModuleItem";
import LessonEditorDialog, { type Lesson } from "./LessonEditorDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  courseId: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CurriculumEditor({ courseId }: Props) {
  const api = useApi();

  // ── Data state ────────────────────────────────────────────────────────────
  const [modules, setModules] = useState<Module[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Add-module state ──────────────────────────────────────────────────────
  const [isAddingModule, setIsAddingModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [isCreatingModule, setIsCreatingModule] = useState(false);

  // ── Lesson editor dialog ──────────────────────────────────────────────────
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // ── DND sensors ──────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }, // prevents accidental drags on click
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // ── Fetch modules ─────────────────────────────────────────────────────────

  const loadModules = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const res = await api.get<Module[]>(`/api/courses/${courseId}/modules`);
    if (res.success && res.data) {
      setModules(res.data);
    } else {
      setLoadError(res.error ?? "Không thể tải chương trình học.");
    }
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  useEffect(() => {
    loadModules();
  }, [loadModules]);

  // ── Add module ────────────────────────────────────────────────────────────

  async function createModule() {
    const trimmed = newModuleTitle.trim();
    if (isCreatingModule || !trimmed) return;
    setIsCreatingModule(true);
    const toastId = toast.loading("Creating module…");
    const res = await api.post<Module>(`/api/courses/${courseId}/modules`, {
      title: trimmed,
    });
    if (res.success && res.data) {
      toast.success("Đã tạo học phần.", { id: toastId });
      setModules((prev) => [...prev, { ...res.data!, lessons: [] }]);
      setNewModuleTitle("");
      setIsAddingModule(false);
    } else {
      toast.error(res.error ?? "Không thể tạo học phần.", { id: toastId });
    }
    setIsCreatingModule(false);
  }

  function handleCreateModuleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void createModule();
  }

  // ── DND drag-end handler ──────────────────────────────────────────────────

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = modules.findIndex((m) => m.id === active.id);
    const newIndex = modules.findIndex((m) => m.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const originalModules = [...modules];
    const reordered = arrayMove(modules, oldIndex, newIndex).map(
      (m, index) => ({
        ...m,
        orderIndex: index,
      }),
    );
    setModules(reordered); // optimistic update

    const orderedIds = reordered.map((m) => m.id);
    // PUT /api/courses/:courseId/modules — bulk reorder endpoint
    const res = await api.put(`/api/courses/${courseId}/modules`, {
      orderedIds,
    });
    if (!res.success) {
      toast.error(
        (res as { error?: string }).error ?? "Không thể sắp xếp lại học phần.",
      );
      setModules(originalModules); // revert
    }
  }

  // ── Module/lesson state lifters ───────────────────────────────────────────

  function handleModuleDeleted(moduleId: string) {
    setModules((prev) => prev.filter((m) => m.id !== moduleId));
  }

  function handleModuleUpdated(updated: Module) {
    setModules((prev) =>
      prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)),
    );
  }

  function handleLessonsUpdated(moduleId: string, lessons: Lesson[]) {
    setModules((prev) =>
      prev.map((m) => (m.id === moduleId ? { ...m, lessons } : m)),
    );
  }

  function handleEditLesson(lesson: Lesson) {
    setEditingLesson(lesson);
    setDialogOpen(true);
  }

  function handleLessonSaved(updated: Lesson) {
    setModules((prev) =>
      prev.map((m) =>
        m.id === updated.moduleId
          ? {
              ...m,
              lessons: m.lessons.map((l) =>
                l.id === updated.id ? updated : l,
              ),
            }
          : m,
      ),
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const sortedModules = [...modules].sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );

  return (
    <div className="pt-8">
      {/* Section header */}
      <div className="mb-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5 sm:items-center">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50">
            <BookOpen size={16} className="text-sky-500" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">
              Chương trình học
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Kéo thả để sắp xếp lại thứ tự học phần · Sử dụng mũi tên để sắp
              xếp lại thứ tự bài học
            </p>
          </div>
        </div>
        {/* Module count badge */}
        <span className="shrink-0 text-xs font-medium tabular-nums text-slate-400">
          {sortedModules.length} học phần
        </span>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl border border-slate-200 bg-slate-50 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {!isLoading && loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0" />
          <span>{loadError}</span>
          <button
            type="button"
            onClick={loadModules}
            className="ml-auto text-xs underline hover:no-underline shrink-0"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !loadError && sortedModules.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-10 flex flex-col items-center gap-2 text-slate-400">
          <BookOpen size={28} className="text-slate-300" />
          <p className="text-sm font-medium">Chưa có học phần nào</p>
          <p className="text-xs">Thêm học phần đầu tiên để bắt đầu.</p>
        </div>
      )}

      {/* ── DND-sortable module list ── */}
      {!isLoading && !loadError && sortedModules.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedModules.map((m) => m.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {sortedModules.map((mod) => (
                <ModuleItem
                  key={mod.id}
                  module={mod}
                  courseId={courseId}
                  onModuleDeleted={handleModuleDeleted}
                  onModuleUpdated={handleModuleUpdated}
                  onLessonsUpdated={handleLessonsUpdated}
                  onEditLesson={handleEditLesson}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* ── Add Module ── */}
      <div className="mt-4">
        {isAddingModule ? (
          <form
            onSubmit={handleCreateModuleSubmit}
            className="flex min-w-0 flex-col gap-2 rounded-xl border border-dashed border-sky-300 bg-sky-50/50 p-3 sm:flex-row sm:items-center"
          >
            <input
              autoFocus
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
              disabled={isCreatingModule}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void createModule();
                }
                if (e.key === "Escape") {
                  setIsAddingModule(false);
                  setNewModuleTitle("");
                }
              }}
              placeholder="New module title…"
              className="min-w-0 flex-1 border-none bg-transparent text-sm text-slate-900 outline-none placeholder-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <Button
              type="submit"
              size="sm"
              disabled={isCreatingModule || !newModuleTitle.trim()}
              className="h-8 shrink-0 gap-1 bg-sky-500 text-white hover:bg-sky-600"
            >
              {isCreatingModule ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Plus size={12} />
              )}
              {isCreatingModule ? "Đang thêm..." : "Thêm học phần"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsAddingModule(false);
                setNewModuleTitle("");
              }}
              disabled={isCreatingModule}
              className="h-8 shrink-0 text-slate-500"
            >
              Hủy
            </Button>
          </form>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsAddingModule(true)}
            className="w-full border-dashed border-slate-300 text-slate-600 hover:border-sky-400 hover:text-sky-600 hover:bg-sky-50 gap-2 rounded-xl h-10"
          >
            <Plus size={15} />
            Thêm học phần
          </Button>
        )}
      </div>

      {/* ── Lesson Editor Dialog ── */}
      <LessonEditorDialog
        lesson={editingLesson}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={handleLessonSaved}
      />
    </div>
  );
}
