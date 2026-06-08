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
import {
  Plus,
  Loader2,
  BookOpen,
  AlertCircle,
} from "lucide-react";
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
    })
  );

  // ── Fetch modules ─────────────────────────────────────────────────────────

  const loadModules = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const res = await api.get<Module[]>(`/api/courses/${courseId}/modules`);
    if (res.success && res.data) {
      setModules(res.data);
    } else {
      setLoadError(res.error ?? "Failed to load curriculum.");
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
      toast.success("Module created.", { id: toastId });
      setModules((prev) => [...prev, { ...res.data!, lessons: [] }]);
      setNewModuleTitle("");
      setIsAddingModule(false);
    } else {
      toast.error(res.error ?? "Failed to create module.", { id: toastId });
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
    const reordered = arrayMove(modules, oldIndex, newIndex).map((m, index) => ({
      ...m,
      orderIndex: index,
    }));
    setModules(reordered); // optimistic update

    const orderedIds = reordered.map((m) => m.id);
    // PUT /api/courses/:courseId/modules — bulk reorder endpoint
    const res = await api.put(`/api/courses/${courseId}/modules`, { orderedIds });
    if (!res.success) {
      toast.error((res as { error?: string }).error ?? "Failed to reorder modules.");
      setModules(originalModules); // revert
    }
  }

  // ── Module/lesson state lifters ───────────────────────────────────────────

  function handleModuleDeleted(moduleId: string) {
    setModules((prev) => prev.filter((m) => m.id !== moduleId));
  }

  function handleModuleUpdated(updated: Module) {
    setModules((prev) =>
      prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
    );
  }

  function handleLessonsUpdated(moduleId: string, lessons: Lesson[]) {
    setModules((prev) =>
      prev.map((m) => (m.id === moduleId ? { ...m, lessons } : m))
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
                l.id === updated.id ? updated : l
              ),
            }
          : m
      )
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const sortedModules = [...modules].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="mt-8 pt-8 border-t border-slate-200">
      {/* Section header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-sky-50 flex items-center justify-center">
            <BookOpen size={16} className="text-sky-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Curriculum</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Drag modules to reorder · Use arrows to reorder lessons
            </p>
          </div>
        </div>
        {/* Module count badge */}
        <span className="text-xs text-slate-400 font-medium tabular-nums">
          {sortedModules.length} module{sortedModules.length !== 1 ? "s" : ""}
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
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !loadError && sortedModules.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-10 flex flex-col items-center gap-2 text-slate-400">
          <BookOpen size={28} className="text-slate-300" />
          <p className="text-sm font-medium">No modules yet</p>
          <p className="text-xs">Add your first module to start building the curriculum.</p>
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
            className="flex items-center gap-2 p-3 rounded-xl border border-dashed border-sky-300 bg-sky-50/50"
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
              className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 placeholder-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <Button
              type="submit"
              size="sm"
              disabled={isCreatingModule || !newModuleTitle.trim()}
              className="h-8 bg-sky-500 hover:bg-sky-600 text-white gap-1 shrink-0"
            >
              {isCreatingModule ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Plus size={12} />
              )}
              {isCreatingModule ? "Adding..." : "Add Module"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setIsAddingModule(false); setNewModuleTitle(""); }}
              disabled={isCreatingModule}
              className="h-8 text-slate-500 shrink-0"
            >
              Cancel
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
            Add Module
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
