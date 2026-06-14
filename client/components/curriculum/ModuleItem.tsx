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
import { LessonType } from "@prisma/client";
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
  ListTodo,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { QuizBuilder } from "@/components/quiz/QuizBuilder";
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
  const [isDeleteModuleDialogOpen, setIsDeleteModuleDialogOpen] =
    useState(false);
  const [lessonPendingDelete, setLessonPendingDelete] = useState<Lesson | null>(
    null,
  );
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);
  const [isAddingLesson, setIsAddingLesson] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonType, setNewLessonType] = useState<LessonType>(
    LessonType.LECTURE,
  );
  const [isCreatingLesson, setIsCreatingLesson] = useState(false);
  const [movingLessonId, setMovingLessonId] = useState<string | null>(null);
  const [quizLesson, setQuizLesson] = useState<Lesson | null>(null);
  const isQuizSheetOpen = Boolean(quizLesson);

  // ── Module title edit ─────────────────────────────────────────────────────

  async function saveTitle() {
    const trimmed = editTitle.trim();
    if (!trimmed || trimmed === module.title) {
      setIsEditingTitle(false);
      return;
    }
    setIsSavingTitle(true);
    const toastId = toast.loading("Đang cập nhật…");
    const res = await api.patch<Module>(
      `/api/courses/${courseId}/modules/${module.id}`,
      { title: trimmed },
    );
    if (res.success && res.data) {
      toast.success("Đã cập nhật học phần.", { id: toastId });
      onModuleUpdated({ ...module, title: trimmed });
    } else {
      toast.error(res.error ?? "Không thể cập nhật học phần.", { id: toastId });
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
    setIsDeletingModule(true);
    const toastId = toast.loading("Đang xóa học phần...");
    const res = await api.del(`/api/courses/${courseId}/modules/${module.id}`);

    if (res.success) {
      toast.success("Đã xóa học phần.", { id: toastId });
      setIsDeleteModuleDialogOpen(false);
      onModuleDeleted(module.id);
    } else {
      toast.error(res.error ?? "Không thể xóa học phần.", { id: toastId });
      setIsDeletingModule(false);
    }
  }

  // ── Add lesson ────────────────────────────────────────────────────────────

  async function createLesson() {
    const trimmed = newLessonTitle.trim();
    if (isCreatingLesson || !trimmed) return;
    setIsCreatingLesson(true);
    const toastId = toast.loading("Đang thêm…");
    const res = await api.post<Lesson>(`/api/modules/${module.id}/lessons`, {
      title: trimmed,
      lessonType: newLessonType,
    });
    if (res.success && res.data) {
      toast.success("Đã thêm bài học.", { id: toastId });
      onLessonsUpdated(module.id, [...module.lessons, res.data]);
      setNewLessonTitle("");
      setNewLessonType(LessonType.LECTURE);
      setIsAddingLesson(false);
    } else {
      toast.error(res.error ?? "Không thể thêm bài học.", { id: toastId });
    }
    setIsCreatingLesson(false);
  }

  function handleCreateLessonSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void createLesson();
  }

  // ── Delete lesson ─────────────────────────────────────────────────────────

  async function deleteLesson(lesson: Lesson) {
    setDeletingLessonId(lesson.id);
    const toastId = toast.loading("Đang xóa bài học...");
    const res = await api.del(`/api/lessons/${lesson.id}`);

    if (res.success) {
      toast.success("Đã xóa bài học.", { id: toastId });
      setLessonPendingDelete(null);
      onLessonsUpdated(
        module.id,
        module.lessons.filter((l) => l.id !== lesson.id),
      );
    } else {
      toast.error(res.error ?? "Không thể xóa bài học.", { id: toastId });
    }

    setDeletingLessonId(null);
  }

  // ── Move lesson Up/Down ───────────────────────────────────────────────────

  async function moveLesson(index: number, direction: "up" | "down") {
    const lessons = [...module.lessons].sort(
      (a, b) => a.orderIndex - b.orderIndex,
    );
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= lessons.length) return;

    // Swap positions locally for instant feedback
    const reordered = [...lessons];
    [reordered[index], reordered[swapIndex]] = [
      reordered[swapIndex],
      reordered[index],
    ];
    const orderedIds = reordered.map((l) => l.id);

    // Optimistic update
    setMovingLessonId(lessons[index].id);
    onLessonsUpdated(
      module.id,
      reordered.map((l, i) => ({ ...l, orderIndex: i })),
    );

    const res = await api.put(`/api/modules/${module.id}/lessons`, {
      orderedIds,
    });
    if (!res.success) {
      toast.error(res.error ?? "Không thể sắp xếp lại bài học.");
      // Revert
      onLessonsUpdated(module.id, lessons);
    }
    setMovingLessonId(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const sortedLessons = [...module.lessons].sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );

  return (
    <>
      <div ref={setNodeRef} style={style}>
        <Card className="border border-slate-200 shadow-sm bg-white rounded-xl overflow-hidden">
          {/* ── Module Header ── */}
          <CardHeader className="flex-row items-center gap-3 py-3 px-4 border-b border-slate-100 bg-slate-50/60 rounded-none">
            {/* Drag handle — touch target isolated from card click area */}
            <button
              type="button"
              className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 transition-colors p-0.5 shrink-0 touch-none"
              aria-label="Kéo để sắp xếp học phần"
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
                    aria-label="Lưu tên học phần"
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
                    aria-label="Hủy chỉnh sửa"
                  >
                    <X size={14} />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-slate-900 truncate">
                    {module.title}
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-xs font-normal shrink-0"
                  >
                    {sortedLessons.length} bài học
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
                  onClick={() => {
                    setEditTitle(module.title);
                    setIsEditingTitle(true);
                  }}
                  className="text-slate-400 hover:text-sky-600 hover:bg-sky-50"
                  aria-label="Chỉnh sửa tên học phần"
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsDeleteModuleDialogOpen(true)}
                  disabled={isDeletingModule}
                  className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                  aria-label="Xóa học phần"
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
                <p className="text-xs">
                  Chưa có bài học. Thêm bài học bên dưới.
                </p>
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
                        aria-label="Đưa bài học lên"
                      >
                        <ChevronUp size={14} />
                      </Button>
                      {/* Down */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => moveLesson(idx, "down")}
                        disabled={
                          idx === sortedLessons.length - 1 ||
                          movingLessonId === lesson.id
                        }
                        className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                        aria-label="Đưa bài học xuống"
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
                        aria-label="Chỉnh sửa nội dung bài học"
                      >
                        <Pencil size={14} />
                      </Button>
                      {lesson.lessonType === LessonType.QUIZ && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setQuizLesson(lesson)}
                          className="h-7 gap-1.5 rounded-lg px-2 text-xs text-slate-500 hover:bg-sky-50 hover:text-sky-600"
                          aria-label={`Quản lý quiz cho ${lesson.title}`}
                        >
                          <ListTodo size={13} />
                        </Button>
                      )}
                      {/* Delete */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setLessonPendingDelete(lesson)}
                        disabled={deletingLessonId === lesson.id}
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                        aria-label="Xóa bài học"
                      >
                        {deletingLessonId === lesson.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* ── Add Lesson inline form ── */}
            <div className="px-4 py-3 border-t border-dashed border-slate-200 bg-slate-50/40">
              {isAddingLesson ? (
                <form onSubmit={handleCreateLessonSubmit} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      autoFocus
                      value={newLessonTitle}
                      onChange={(e) => setNewLessonTitle(e.target.value)}
                      disabled={isCreatingLesson}
                      placeholder="Tên bài học…"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void createLesson();
                        }
                        if (e.key === "Escape") {
                          setIsAddingLesson(false);
                          setNewLessonTitle("");
                          setNewLessonType(LessonType.LECTURE);
                        }
                      }}
                      className="h-8 text-sm"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isCreatingLesson || !newLessonTitle.trim()}
                      className="h-8 bg-sky-500 hover:bg-sky-600 text-white shrink-0 gap-1"
                    >
                      {isCreatingLesson ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Check size={12} />
                      )}
                      {isCreatingLesson ? "Đang thêm..." : "Thêm"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setIsAddingLesson(false);
                        setNewLessonTitle("");
                        setNewLessonType(LessonType.LECTURE);
                      }}
                      disabled={isCreatingLesson}
                      className="text-slate-400 hover:text-slate-700 shrink-0"
                    >
                      <X size={14} />
                    </Button>
                  </div>
                  <RadioGroup
                    value={newLessonType}
                    onValueChange={(value) =>
                      setNewLessonType(value as LessonType)
                    }
                    className="grid gap-2 sm:grid-cols-2"
                  >
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:border-sky-200 hover:bg-sky-50">
                      <RadioGroupItem value={LessonType.LECTURE} />
                      Bài giảng
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:border-sky-200 hover:bg-sky-50">
                      <RadioGroupItem value={LessonType.QUIZ} />
                      Quiz
                    </label>
                  </RadioGroup>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingLesson(true)}
                  className="w-full flex items-center gap-2 text-xs text-slate-500 hover:text-sky-600 transition-colors py-0.5"
                >
                  <Plus size={14} />
                  Thêm bài học
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Sheet
        open={isQuizSheetOpen}
        onOpenChange={(open) => {
          if (!open) setQuizLesson(null);
        }}
      >
        <SheetContent
          side="right"
          className="flex w-[90vw]! max-w-4xl! flex-col gap-0 p-0 sm:w-[90vw]!"
        >
          <SheetHeader className="border-b border-slate-100 px-6 py-5 text-left">
            <SheetTitle>Quản lý quiz</SheetTitle>
            <SheetDescription className="truncate">
              {quizLesson?.title ?? "Cấu hình câu hỏi và thiết lập quiz."}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto bg-slate-50/40 p-6">
            {quizLesson && <QuizBuilder lessonId={quizLesson.id} />}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={isDeleteModuleDialogOpen}
        onOpenChange={(open) => {
          if (!isDeletingModule) setIsDeleteModuleDialogOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa học phần?</AlertDialogTitle>
            <AlertDialogDescription>
              Thao tác này sẽ xóa học phần "{module.title}" và toàn bộ bài học
              bên trong. Không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingModule}>
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeletingModule}
              onClick={(event) => {
                event.preventDefault();
                void deleteModule();
              }}
              className="gap-2"
            >
              {isDeletingModule && (
                <Loader2 size={14} className="animate-spin" />
              )}
              Xóa học phần
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={lessonPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletingLessonId) setLessonPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa bài học?</AlertDialogTitle>
            <AlertDialogDescription>
              Thao tác này sẽ xóa bài học "{lessonPendingDelete?.title}" và các
              tài liệu liên quan. Không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingLessonId !== null}>
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={
                deletingLessonId !== null || lessonPendingDelete === null
              }
              onClick={(event) => {
                event.preventDefault();
                if (lessonPendingDelete) void deleteLesson(lessonPendingDelete);
              }}
              className="gap-2"
            >
              {deletingLessonId !== null && (
                <Loader2 size={14} className="animate-spin" />
              )}
              Xóa bài học
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
