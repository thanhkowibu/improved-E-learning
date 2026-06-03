"use client";

/**
 * app/(dashboard)/courses/[courseId]/lessons/[lessonId]/page.tsx
 *
 * Phase 3E — Student Lesson Viewer with Progress Tracking.
 *
 * Data flow:
 *   1. GET /api/lessons/[lessonId]          — full lesson detail
 *   2. GET /api/courses/[courseId]/modules  — sibling lessons for nav pills
 *   3. GET /api/lessons/[lessonId]/progress — current user's completion status
 *   4. PUT /api/lessons/[lessonId]/progress — toggle completion (optimistic UI)
 */

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Bookmark,
  Download,
  AlertCircle,
  Loader2,
  FileText,
  FileVideo,
  Archive,
  File as FileIcon,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useApi } from "@/hooks/useApi";

// ─── Dynamic import — SSR safe ────────────────────────────────────────────────

const MarkdownPreview = dynamic(
  () => import("@uiw/react-md-editor").then((m) => m.default.Markdown),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-48 w-full rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    ),
  }
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface MaterialItem {
  id: string;
  title: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSizeBytes: string | number | null;
  materialType: string;
}

interface ModuleInfo {
  id: string;
  title: string;
  courseId: string;
  course: { id: string; title: string; teacherId: string; isPublished: boolean };
}

interface LessonDetail {
  id: string;
  title: string;
  content: string | null;
  orderIndex: number;
  moduleId: string;
  materials: MaterialItem[];
  module: ModuleInfo;
}

interface LessonStub {
  id: string;
  title: string;
  orderIndex: number;
}

interface ModuleStub {
  id: string;
  title: string;
  orderIndex: number;
  lessons: LessonStub[];
}

interface ProgressResponse {
  isCompleted: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTENT_CLS = "mx-auto px-6 md:px-12 lg:px-24 max-w-5xl";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: string | number | null): string {
  if (bytes === null || bytes === undefined) return "";
  const n = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (isNaN(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function MaterialIcon({ mimeType }: { mimeType?: string }) {
  const t = mimeType ?? "";
  if (t.startsWith("video/")) return <FileVideo size={15} className="text-violet-500 shrink-0" />;
  if (t.includes("zip") || t.includes("rar") || t.includes("tar"))
    return <Archive size={15} className="text-orange-500 shrink-0" />;
  if (t.includes("pdf")) return <FileText size={15} className="text-red-500 shrink-0" />;
  return <FileIcon size={15} className="text-sky-500 shrink-0" />;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LessonSkeleton() {
  return (
    <div className={`${CONTENT_CLS} py-6 space-y-6`}>
      <div className="flex gap-2">
        <Skeleton className="h-4 w-20 rounded" />
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-28 rounded" />
      </div>
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-9 rounded-lg" />
        ))}
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
      <Separator />
      <Skeleton className="h-8 w-64 rounded-xl" />
      <Skeleton className="h-10 w-44 rounded-xl" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className={`h-4 rounded ${i % 2 === 0 ? "w-3/4" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}

// ─── Mark-Complete Button ─────────────────────────────────────────────────────

function MarkCompleteButton({
  isCompleted,
  isPending,
  onClick,
}: {
  isCompleted: boolean;
  isPending: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className={cn(
        "gap-2 rounded-xl px-5 h-10 font-semibold text-sm transition-all duration-200",
        isCompleted
          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200"
          : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50"
      )}
    >
      {isPending ? (
        <Loader2 size={15} className="animate-spin" />
      ) : isCompleted ? (
        <CheckCircle2 size={15} />
      ) : (
        <Circle size={15} />
      )}
      {isCompleted ? "Completed" : "Mark as Complete"}
    </Button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LessonViewPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.courseId as string;
  const lessonId = params?.lessonId as string;

  const api = useApi();

  // ── State ──────────────────────────────────────────────────────────────────
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [modules, setModules] = useState<ModuleStub[]>([]);
  const [isLessonLoading, setIsLessonLoading] = useState(true);
  const [isNavLoading, setIsNavLoading] = useState(true);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Progress state
  const [isCompleted, setIsCompleted] = useState(false);
  const [isProgressPending, setIsProgressPending] = useState(false);

  // ── Fetch lesson detail ────────────────────────────────────────────────────
  const fetchLesson = useCallback(async () => {
    if (!lessonId) return;
    setIsLessonLoading(true);
    setLessonError(null);
    const res = await api.get<LessonDetail>(`/api/lessons/${lessonId}`);
    if (res.success && res.data) {
      setLesson(res.data);
    } else {
      setLessonError(res.error ?? res.message ?? "Lesson not found.");
    }
    setIsLessonLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  // ── Fetch sibling lessons ──────────────────────────────────────────────────
  const fetchModules = useCallback(async () => {
    if (!courseId) return;
    setIsNavLoading(true);
    const res = await api.get<ModuleStub[]>(`/api/courses/${courseId}/modules`);
    if (res.success && res.data) {
      setModules(res.data);
    }
    setIsNavLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // ── Fetch current progress ─────────────────────────────────────────────────
  const fetchProgress = useCallback(async () => {
    if (!lessonId) return;
    const res = await api.get<ProgressResponse>(`/api/lessons/${lessonId}/progress`);
    if (res.success && res.data) {
      setIsCompleted(res.data.isCompleted);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  useEffect(() => { fetchLesson(); }, [fetchLesson]);
  useEffect(() => { fetchModules(); }, [fetchModules]);
  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  // ── Toggle completion ──────────────────────────────────────────────────────
  const handleToggleComplete = useCallback(async () => {
    const newValue = !isCompleted;
    setIsCompleted(newValue);   // Optimistic update
    setIsProgressPending(true);

    const res = await api.put<ProgressResponse>(
      `/api/lessons/${lessonId}/progress`,
      { isCompleted: newValue }
    );

    if (!res.success) {
      setIsCompleted(!newValue); // Rollback on error
    }
    setIsProgressPending(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompleted, lessonId]);

  // ── Derived navigation ─────────────────────────────────────────────────────

  const allLessons = useMemo<LessonStub[]>(() => {
    return modules
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .flatMap((m) => m.lessons.slice().sort((a, b) => a.orderIndex - b.orderIndex));
  }, [modules]);

  const siblingLessons = useMemo<LessonStub[]>(() => {
    if (!lesson) return [];
    const mod = modules.find((m) => m.id === lesson.moduleId);
    if (!mod) return [];
    return mod.lessons.slice().sort((a, b) => a.orderIndex - b.orderIndex);
  }, [lesson, modules]);

  const currentModule = useMemo<ModuleStub | undefined>(() => {
    if (!lesson) return undefined;
    return modules.find((m) => m.id === lesson.moduleId);
  }, [lesson, modules]);

  const currentGlobalIndex = useMemo(
    () => allLessons.findIndex((l) => l.id === lessonId),
    [allLessons, lessonId]
  );

  const prevLessonId = currentGlobalIndex > 0
    ? allLessons[currentGlobalIndex - 1].id
    : null;

  const nextLessonId =
    currentGlobalIndex !== -1 && currentGlobalIndex < allLessons.length - 1
      ? allLessons[currentGlobalIndex + 1].id
      : null;

  function navigateTo(targetId: string | null) {
    if (targetId) router.push(`/courses/${courseId}/lessons/${targetId}`);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLessonLoading) return <LessonSkeleton />;

  if (lessonError || !lesson) {
    return (
      <div className={`${CONTENT_CLS} py-24 flex flex-col items-center gap-4 text-center`}>
        <div className="h-16 w-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertCircle size={32} className="text-red-400" />
        </div>
        <p className="text-xl font-bold text-slate-800">Lesson not found</p>
        <p className="text-slate-500 text-sm max-w-sm">
          {lessonError ?? "This lesson may have been removed or is unavailable."}
        </p>
        <Link
          href={`/courses/${courseId}/learn`}
          className="text-sky-600 text-sm hover:underline flex items-center gap-1"
        >
          <ChevronLeft size={14} />
          Back to Course Overview
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className={`${CONTENT_CLS} pt-6`}>

        {/* ══ BREADCRUMB ══════════════════════════════════════════════════════ */}
        <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500 mb-6">
          <Link
            href={`/courses/${courseId}/learn`}
            className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-md border border-slate-200 hover:border-sky-300 hover:bg-sky-50 transition-colors mr-1"
            aria-label="Back to course overview"
          >
            <BookOpen size={13} className="text-slate-500" />
          </Link>
          <Link href={`/courses/${courseId}/learn`} className="hover:text-sky-600 transition-colors truncate max-w-[10rem]">
            {lesson.module.course.title}
          </Link>
          <ChevronRight size={13} className="shrink-0 opacity-40" />
          <span className="truncate max-w-[10rem] text-slate-500">
            {lesson.module.title}
          </span>
          <ChevronRight size={13} className="shrink-0 opacity-40" />
          <span className="truncate max-w-[12rem] font-semibold text-slate-800">
            {lesson.title}
          </span>
        </nav>

        {/* ══ NAV PILLS + TOP PREV/NEXT ════════════════════════════════════════ */}
        <div className="flex items-center gap-2 mb-8">
          {/* Lesson pills */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto pb-1 scrollbar-none">
            {isNavLoading
              ? [1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-9 w-9 rounded-lg shrink-0" />
              ))
              : siblingLessons.map((sib, idx) => {
                const isActive = sib.id === lessonId;
                return (
                  <Link
                    key={sib.id}
                    href={`/courses/${courseId}/lessons/${sib.id}`}
                    title={sib.title}
                    aria-label={`Lesson ${idx + 1}: ${sib.title}`}
                    className={cn(
                      "shrink-0 flex items-center justify-center h-9 w-9 rounded-lg border transition-all duration-150 text-sm font-semibold",
                      isActive
                        ? "bg-sky-600 border-sky-600 text-white shadow-sm shadow-sky-200"
                        : "border-slate-200 bg-white text-slate-500 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600"
                    )}
                  >
                    <BookOpen size={14} />
                  </Link>
                );
              })}
          </div>

          {/* Top Prev / Next */}
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <Button
              variant="outline"
              size="sm"
              disabled={!prevLessonId && !isNavLoading}
              onClick={() => navigateTo(prevLessonId)}
              className="gap-1.5 rounded-lg border-slate-200 text-slate-600 hover:border-sky-300 hover:text-sky-600 hover:bg-sky-50 disabled:opacity-40"
            >
              <ChevronLeft size={15} />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!nextLessonId && !isNavLoading}
              onClick={() => navigateTo(nextLessonId)}
              className="gap-1.5 rounded-lg border-slate-200 text-slate-600 hover:border-sky-300 hover:text-sky-600 hover:bg-sky-50 disabled:opacity-40"
            >
              Next
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>

        <Separator className="mb-8" />

        {/* ══ TITLE + ACTIONS ROW ══════════════════════════════════════════════ */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
              {lesson.title}
            </h1>
          </div>

          {/* Mark as Complete button */}
          <div className="shrink-0">
            <MarkCompleteButton
              isCompleted={isCompleted}
              isPending={isProgressPending}
              onClick={handleToggleComplete}
            />
          </div>
        </div>

        {/* Bookmark (secondary action — below title row) */}
        <button
          type="button"
          onClick={() => setIsBookmarked((b) => !b)}
          className={cn(
            "inline-flex items-center gap-2 text-sm font-medium mb-8 transition-colors",
            isBookmarked ? "text-sky-600" : "text-slate-400 hover:text-sky-500"
          )}
          aria-label={isBookmarked ? "Remove bookmark" : "Bookmark this lesson"}
        >
          <Bookmark
            size={15}
            className={cn("transition-all", isBookmarked && "fill-current")}
          />
          {isBookmarked ? "Bookmarked" : "Bookmark this lesson"}
        </button>

        {/* ══ MARKDOWN CONTENT ═════════════════════════════════════════════════ */}
        <div
          data-color-mode="light"
          className="prose prose-slate max-w-none mb-10
            prose-headings:font-bold prose-headings:text-slate-900
            prose-p:text-slate-700 prose-p:leading-relaxed
            prose-a:text-sky-600 prose-a:no-underline hover:prose-a:underline
            prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
            prose-pre:bg-slate-900 prose-pre:rounded-xl
            prose-blockquote:border-sky-400 prose-blockquote:text-slate-600
            prose-img:rounded-xl prose-img:shadow-sm"
        >
          {lesson.content ? (
            <MarkdownPreview source={lesson.content} />
          ) : (
            <div className="flex flex-col items-center gap-3 py-16 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50">
              <BookOpen size={28} className="text-slate-300" />
              <p className="text-slate-400 text-sm">
                No content available for this lesson yet.
              </p>
            </div>
          )}
        </div>

        {/* ══ MATERIALS ════════════════════════════════════════════════════════ */}
        {lesson.materials.length > 0 && (
          <div className="mb-12">
            <Separator className="mb-6" />
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <FileText size={16} className="text-sky-500" />
              Lesson Materials
              <span className="text-xs font-normal text-slate-400 ml-1">
                ({lesson.materials.length})
              </span>
            </h2>
            <ul className="space-y-2">
              {lesson.materials.map((mat) => (
                <li
                  key={mat.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 hover:bg-sky-50/50 hover:border-sky-200 transition-all group"
                >
                  <MaterialIcon mimeType={mat.mimeType} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{mat.title}</p>
                    {mat.fileSizeBytes !== null && (
                      <p className="text-xs text-slate-400">{formatBytes(mat.fileSizeBytes)}</p>
                    )}
                  </div>
                  <a
                    href={`/api/materials/${mat.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                    aria-label={`Download ${mat.title}`}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg text-xs font-medium"
                    >
                      <Download size={13} />
                      Download
                    </Button>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ══ BOTTOM PAGINATION ════════════════════════════════════════════════ */}
        <Separator className="mb-8" />

        <div className="flex items-center justify-center gap-4 pb-6">
          <Button
            variant="outline"
            disabled={!prevLessonId && !isNavLoading}
            onClick={() => navigateTo(prevLessonId)}
            className="gap-2 rounded-xl px-6 h-11 font-semibold border-slate-200 text-slate-600 hover:border-sky-300 hover:text-sky-700 hover:bg-sky-50 disabled:opacity-40"
          >
            <ChevronLeft size={16} />
            Previous
          </Button>

          {/* Module context pill */}
          {currentModule && (
            <div className="hidden sm:flex flex-col items-center gap-0.5 text-center px-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                {currentModule.title}
              </span>
              <span className="text-xs text-slate-500">
                {siblingLessons.findIndex((l) => l.id === lessonId) + 1}
                {" / "}
                {siblingLessons.length}
              </span>
            </div>
          )}

          <Button
            variant="outline"
            disabled={!nextLessonId && !isNavLoading}
            onClick={() => navigateTo(nextLessonId)}
            className="gap-2 rounded-xl px-6 h-11 font-semibold border-slate-200 text-slate-600 hover:border-sky-300 hover:text-sky-700 hover:bg-sky-50 disabled:opacity-40"
          >
            Next
            <ChevronRight size={16} />
          </Button>
        </div>

        {/* ── Bottom "Mark Complete" convenience repeat ─────────────────────── */}
        <div className="flex justify-center mt-4 pb-4">
          <MarkCompleteButton
            isCompleted={isCompleted}
            isPending={isProgressPending}
            onClick={handleToggleComplete}
          />
        </div>

      </div>
    </div>
  );
}
