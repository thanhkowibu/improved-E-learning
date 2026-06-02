"use client";

/**
 * components/curriculum/ModuleItem.tsx
 *
 * A single draggable Module card rendered inside CurriculumEditor.
 *
 * Drag & Drop:
 *   Uses @dnd-kit/sortable hooks (useSortable). The drag handle is the only
 *   activator — clicking Edit/Delete/Add-Lesson buttons does NOT initiate a drag.
 *
 * Lesson ordering:
 *   Up/Down arrow buttons adjust the lesson's position locally and then call
 *   PUT /api/modules/:moduleId/lessons with { orderedIds } to persist.
 *   This avoids nested DND context complexity.
 *
 * Props:
 *   module     — the module data (with its lessons array)
 *   courseId   — needed to build the module PATCH/DELETE URL
 *   onModuleDeleted(moduleId) — lift state up
 *   onModuleUpdated(updated)  — lift state up
 *   onLessonsUpdated(moduleId, lessons) — lift state up
 *   onEditLesson(lesson)      — opens the LessonEditorDialog
 */

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import {
  GripVertical,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
  Loader2,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/hooks/useApi";
import type { Lesson } from "./LessonEditorDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Module {
  id: string;
  title: string;
  orderIndex: number;
  lessons: Lesson[];
}

interface Props {
  module: Module;
  courseId: string;
  onModuleDeleted: (moduleId: string) => void;
  onModuleUpdated: (updated: Module) => void;
  onLessonsUpdated: (moduleId: string, lessons: Lesson[]) => void;
  onEditLesson: (lesson: Lesson) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ModuleItem({
  module,
  courseId,
  onModuleDeleted,
  onModuleUpdated,
  onLessonsUpdated,
  onEditLesson,
}: Props) {
  const api = useApi();

  // ── DND sortable setup ────────────────────────────────────────────────────
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  // ── Local UI state ────────────────────────────────────────────────────────
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(module.title);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isDeletingModule, setIsDeletingModule] = useState(false);
  const [isAddingLesson, setIsAddingLesson] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [isCreatingLesson, setIsCreatingLesson] = useState(false);
  const [movingLessonId, setMovingLessonId] = useState<string | null>(null);

  // ── Module title edit ─────────────────────────────────────────────────────

  async function saveTitle() {
    const trimmed = editTitle.trim();
    if (!trimmed || trimmed === module.title) {
      setIsEditingTitle(false);
      return;
    }
    setIsSavingTitle(true);
    const toastId = toast.loading("Updating module…");
    const res = await api.patch<Module>(
      `/api/courses/${courseId}/modules/${module.id}`,
      { title: trimmed }
    );
    if (res.success && res.data) {
      toast.success("Module updated.", { id: toastId });
      onModuleUpdated({ ...module, title: trimmed });
    } else {
      toast.error(res.error ?? "Failed to update module.", { id: toastId });
      setEditTitle(module.title); // revert
    }
    setIsSavingTitle(false);
    setIsEditingTitle(false);
  }

  function cancelTitleEdit() {
    setEditTitle(module.title);
    setIsEditingTitle(false);
  }

  // ── Module delete ─────────────────────────────────────────────────────────

  async function deleteModule() {
    if (!confirm(`Delete module "${module.title}" and all its lessons? This cannot be undone.`)) return;
    setIsDeletingModule(true);
    const toastId = toast.loading("Deleting module…");
    const res = await api.del(`/api/courses/${courseId}/modules/${module.id}`);
    if (res.success) {
      toast.success("Module deleted.", { id: toastId });
      onModuleDeleted(module.id);
    } else {
      toast.error(res.error ?? "Failed to delete module.", { id: toastId });
      setIsDeletingModule(false);
    }
  }

  // ── Add lesson ────────────────────────────────────────────────────────────

  async function createLesson() {
    const trimmed = newLessonTitle.trim();
    if (!trimmed) return;
    setIsCreatingLesson(true);
    const toastId = toast.loading("Adding lesson…");
    const res = await api.post<Lesson>(
      `/api/modules/${module.id}/lessons`,
      { title: trimmed }
    );
    if (res.success && res.data) {
      toast.success("Lesson added.", { id: toastId });
      onLessonsUpdated(module.id, [...module.lessons, res.data]);
      setNewLessonTitle("");
      setIsAddingLesson(false);
    } else {
      toast.error(res.error ?? "Failed to add lesson.", { id: toastId });
    }
    setIsCreatingLesson(false);
  }

  // ── Delete lesson ─────────────────────────────────────────────────────────

  async function deleteLesson(lesson: Lesson) {
    if (!confirm(`Delete lesson "${lesson.title}"? This cannot be undone.`)) return;
    const toastId = toast.loading("Deleting lesson…");
    const res = await api.del(`/api/lessons/${lesson.id}`);
    if (res.success) {
      toast.success("Lesson deleted.", { id: toastId });
      onLessonsUpdated(module.id, module.lessons.filter((l) => l.id !== lesson.id));
    } else {
      toast.error(res.error ?? "Failed to delete lesson.", { id: toastId });
    }
  }

  // ── Move lesson Up/Down ───────────────────────────────────────────────────

  async function moveLesson(index: number, direction: "up" | "down") {
    const lessons = [...module.lessons].sort((a, b) => a.orderIndex - b.orderIndex);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= lessons.length) return;

    // Swap positions locally for instant feedback
    const reordered = [...lessons];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
    const orderedIds = reordered.map((l) => l.id);

    // Optimistic update
    setMovingLessonId(lessons[index].id);
    onLessonsUpdated(module.id, reordered.map((l, i) => ({ ...l, orderIndex: i })));

    const res = await api.put(`/api/modules/${module.id}/lessons`, { orderedIds });
    if (!res.success) {
      toast.error(res.error ?? "Failed to reorder lessons.");
      // Revert
      onLessonsUpdated(module.id, lessons);
    }
    setMovingLessonId(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const sortedLessons = [...module.lessons].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="border border-slate-200 shadow-sm bg-white rounded-xl overflow-hidden">
        {/* ── Module Header ── */}
        <CardHeader className="flex-row items-center gap-3 py-3 px-4 border-b border-slate-100 bg-slate-50/60 rounded-none">
          {/* Drag handle — touch target isolated from card click area */}
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 transition-colors p-0.5 shrink-0 touch-none"
            aria-label="Drag to reorder module"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={18} />
          </button>

          {/* Title or inline edit */}
          <div className="flex-1 min-w-0">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTitle();
                    if (e.key === "Escape") cancelTitleEdit();
                  }}
                  className="h-8 text-sm font-semibold"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={saveTitle}
                  disabled={isSavingTitle}
                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                  aria-label="Save module title"
                >
                  {isSavingTitle ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={cancelTitleEdit}
                  className="text-slate-500 hover:text-slate-700"
                  aria-label="Cancel edit"
                >
                  <X size={14} />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-semibold text-slate-900 truncate">
                  {module.title}
                </span>
                <Badge variant="secondary" className="text-xs font-normal shrink-0">
                  {sortedLessons.length} lesson{sortedLessons.length !== 1 ? "s" : ""}
                </Badge>
              </div>
            )}
          </div>

          {/* Module action buttons */}
          {!isEditingTitle && (
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => { setEditTitle(module.title); setIsEditingTitle(true); }}
                className="text-slate-400 hover:text-sky-600 hover:bg-sky-50"
                aria-label="Edit module title"
              >
                <Pencil size={14} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={deleteModule}
                disabled={isDeletingModule}
                className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                aria-label="Delete module"
              >
                {isDeletingModule ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
              </Button>
            </div>
          )}
        </CardHeader>

        {/* ── Lesson List ── */}
        <CardContent className="p-0">
          {sortedLessons.length === 0 ? (
            <div className="py-6 flex flex-col items-center gap-1.5 text-slate-400">
              <BookOpen size={20} className="text-slate-300" />
              <p className="text-xs">No lessons yet. Add one below.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sortedLessons.map((lesson, idx) => (
                <li
                  key={lesson.id}
                  className="flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-slate-50/80 transition-colors group/lesson"
                >
                  {/* Lesson index */}
                  <span className="text-xs font-medium text-slate-400 w-5 text-center shrink-0 tabular-nums">
                    {idx + 1}
                  </span>

                  {/* Lesson title */}
                  <span className="flex-1 text-sm text-slate-800 truncate min-w-0">
                    {lesson.title}
                  </span>

                  {/* Lesson action buttons */}
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover/lesson:opacity-100 transition-opacity">
                    {/* Up */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => moveLesson(idx, "up")}
                      disabled={idx === 0 || movingLessonId === lesson.id}
                      className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      aria-label="Move lesson up"
                    >
                      <ChevronUp size={14} />
                    </Button>
                    {/* Down */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => moveLesson(idx, "down")}
                      disabled={idx === sortedLessons.length - 1 || movingLessonId === lesson.id}
                      className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      aria-label="Move lesson down"
                    >
                      <ChevronDown size={14} />
                    </Button>
                    {/* Edit */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onEditLesson(lesson)}
                      className="text-slate-400 hover:text-sky-600 hover:bg-sky-50"
                      aria-label="Edit lesson content"
                    >
                      <Pencil size={14} />
                    </Button>
                    {/* Delete */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => deleteLesson(lesson)}
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                      aria-label="Delete lesson"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* ── Add Lesson inline form ── */}
          <div className="px-4 py-3 border-t border-dashed border-slate-200 bg-slate-50/40">
            {isAddingLesson ? (
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={newLessonTitle}
                  onChange={(e) => setNewLessonTitle(e.target.value)}
                  placeholder="Lesson title…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createLesson();
                    if (e.key === "Escape") { setIsAddingLesson(false); setNewLessonTitle(""); }
                  }}
                  className="h-8 text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={createLesson}
                  disabled={isCreatingLesson || !newLessonTitle.trim()}
                  className="h-8 bg-sky-500 hover:bg-sky-600 text-white shrink-0 gap-1"
                >
                  {isCreatingLesson ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Check size={12} />
                  )}
                  Add
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => { setIsAddingLesson(false); setNewLessonTitle(""); }}
                  className="text-slate-400 hover:text-slate-700 shrink-0"
                >
                  <X size={14} />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingLesson(true)}
                className="w-full flex items-center gap-2 text-xs text-slate-500 hover:text-sky-600 transition-colors py-0.5"
              >
                <Plus size={14} />
                Add Lesson
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
