"use client";

/**
 * app/(dashboard)/courses/[courseId]/learn/page.tsx
 *
 * Course Syllabus / Overview Page — Student Learning Hub.
 *
 * This is where enrolled students land after clicking "Go to Course".
 * It shows:
 *   - A compact hero with course title, teacher, and overall completion progress.
 *   - A two-column layout (main content + right sidebar).
 *   - A clickable Accordion curriculum (module list → lesson links).
 *   - Quick-action sidebar with start/continue lesson CTA.
 *
 * Layout:  Top-nav only (inherits from DashboardLayout).
 * Data:    Uses a dedicated learn endpoint that returns course details and
 *          completed lesson IDs in one request.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChevronRight,
  GraduationCap,
  Layers,
  BookOpen,
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Award,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { StickyChatTrigger } from "@/components/chat/StickyChatTrigger";
import { cn } from "@/lib/utils";
import { useApi } from "@/hooks/useApi";
import type {
  CourseDetail,
  ModuleSummary,
  LessonSummary,
} from "@/hooks/useCourseDetail";

interface LearnPageData {
  course: CourseDetail;
  completedLessonIds: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Shared container — mirrors the Navbar exactly. */
const CONTENT_CLS =
  "mx-auto w-full min-w-0 max-w-7xl overflow-x-hidden px-4 sm:px-6 md:px-12 lg:px-24";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LearnSkeleton() {
  return (
    <div>
      {/* Hero skeleton */}
      <div className="h-52 w-full bg-linear-to-br from-sky-600 via-sky-500 to-sky-400 animate-pulse" />
      <div className={`${CONTENT_CLS} py-8`}>
        <div className="flex gap-8">
          <div className="flex-1 space-y-4">
            <Skeleton className="h-7 w-48 rounded-xl" />
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
          <div className="hidden lg:block w-72 space-y-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Lesson Row ───────────────────────────────────────────────────────────────

function LessonRow({
  lesson,
  courseId,
  isCompleted,
  isNext,
  index,
}: {
  lesson: LessonSummary;
  courseId: string;
  isCompleted: boolean;
  isNext: boolean;
  index: number;
}) {
  return (
    <Link
      href={`/courses/${courseId}/lessons/${lesson.id}`}
      className={cn(
        "group flex w-full min-w-0 max-w-full items-center gap-2 overflow-hidden rounded-xl px-3 py-3 transition-all duration-150 sm:gap-3 sm:px-4",
        "hover:bg-sky-50/80 hover:shadow-sm",
        isNext && "bg-sky-50/60 ring-1 ring-sky-200",
        isCompleted && "opacity-80",
      )}
    >
      {/* Status icon */}
      <div className="shrink-0 flex items-center justify-center w-7 h-7">
        {isCompleted ? (
          <CheckCircle2
            size={18}
            className="text-emerald-500"
            aria-label="Đã hoàn thành"
          />
        ) : isNext ? (
          <PlayCircle
            size={18}
            className="text-sky-500 group-hover:scale-110 transition-transform"
            aria-label="Tiếp tục bài học"
          />
        ) : (
          <span className="text-xs font-semibold text-slate-400 w-5 text-center tabular-nums">
            {index + 1}
          </span>
        )}
      </div>

      {/* Lesson title */}
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm font-medium leading-snug",
          isCompleted
            ? "text-slate-500 line-through decoration-slate-300"
            : "text-slate-700 group-hover:text-sky-700",
        )}
      >
        {lesson.title}
      </span>

      {/* "Next" chip */}
      {isNext && (
        <Badge className="hidden h-5 shrink-0 bg-sky-100 text-[10px] font-semibold text-sky-700 sm:inline-flex">
          Tiếp theo
        </Badge>
      )}

      {/* Arrow on hover */}
      <ChevronRight
        size={14}
        className="shrink-0 text-slate-300 group-hover:text-sky-500 transition-colors"
      />
    </Link>
  );
}

// ─── Module Accordion Item ────────────────────────────────────────────────────

function ModuleItem({
  mod,
  index,
  courseId,
  completedLessonIds,
  nextLessonId,
}: {
  mod: ModuleSummary;
  index: number;
  courseId: string;
  completedLessonIds: Set<string>;
  nextLessonId: string | null;
}) {
  const completedCount = mod.lessons.filter((l) =>
    completedLessonIds.has(l.id),
  ).length;
  const total = mod.lessons.length;
  const allDone = total > 0 && completedCount === total;

  return (
    <AccordionItem
      value={mod.id}
      className="box-border w-full min-w-0 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs sm:max-w-full"
    >
      <AccordionTrigger
        className={cn(
          "box-border w-full min-w-0 max-w-full overflow-hidden rounded-none px-4 py-4 transition-colors hover:bg-slate-50/60 hover:no-underline sm:px-5",
          "[&>svg]:hidden", // hide default chevron — we render our own badge
        )}
      >
        <div className="flex min-w-0 max-w-full flex-1 items-center gap-2 overflow-hidden sm:gap-3">
          {/* Module number badge */}
          <span
            className={cn(
              "h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
              allDone
                ? "bg-emerald-50 text-emerald-600"
                : "bg-sky-50 text-sky-600",
            )}
          >
            {allDone ? (
              <CheckCircle2 size={14} className="text-emerald-500" />
            ) : (
              index + 1
            )}
          </span>

          {/* Title + count */}
          <div className="min-w-0 flex-1 overflow-hidden text-left">
            <p className="font-semibold text-slate-900 text-sm leading-snug truncate">
              {mod.title}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Hoàn thành {completedCount}/{total} bài học
            </p>
          </div>

          {/* Mini progress ring replacement: compact progress bar */}
          {total > 0 && (
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-sky-400 transition-all duration-500"
                  style={{ width: `${(completedCount / total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </AccordionTrigger>

      <AccordionContent className="min-w-0 max-w-full overflow-hidden px-1 pb-2 sm:px-2">
        {mod.lessons.length === 0 ? (
          <p className="px-4 py-3 text-sm text-slate-400 italic">
            Chưa có bài học trong học phần này.
          </p>
        ) : (
          <div className="min-w-0 max-w-full space-y-0.5 overflow-hidden pt-1">
            {mod.lessons.map((lesson, lessonIdx) => (
              <LessonRow
                key={lesson.id}
                lesson={lesson}
                courseId={courseId}
                isCompleted={completedLessonIds.has(lesson.id)}
                isNext={lesson.id === nextLessonId}
                index={lessonIdx}
              />
            ))}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

// ─── Right Sidebar ─────────────────────────────────────────────────────────────

function CourseSidebar({
  courseId,
  course,
  completionPct,
  nextLessonId,
  totalLessons,
  completedCount,
}: {
  courseId: string;
  course: {
    title: string;
    thumbnailUrl: string | null;
    teacher: { fullName: string };
  };
  completionPct: number;
  nextLessonId: string | null;
  totalLessons: number;
  completedCount: number;
}) {
  return (
    <aside className="space-y-4">
      {/* Course thumbnail card */}
      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
        {course.thumbnailUrl ? (
          <img
            src={course.thumbnailUrl}
            alt={course.title}
            className="w-full aspect-video object-cover"
          />
        ) : (
          <div className="w-full aspect-video bg-linear-to-br from-sky-300 to-sky-500 flex items-center justify-center">
            <BookOpen size={40} className="text-white/80" />
          </div>
        )}

        <div className="p-4 space-y-4">
          {/* Teacher */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-linear-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {course.teacher.fullName
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500">Giảng viên</p>
              <p className="text-sm font-semibold text-slate-900 truncate">
                {course.teacher.fullName}
              </p>
            </div>
          </div>

          <Separator />

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center rounded-xl bg-slate-50 py-3 px-2">
              <span className="text-lg font-bold text-slate-900">
                {totalLessons}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5">Bài học</span>
            </div>
            <div className="flex flex-col items-center rounded-xl bg-emerald-50 py-3 px-2">
              <span className="text-lg font-bold text-emerald-700">
                {completedCount}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5">Đã xong</span>
            </div>
          </div>
        </div>
      </div>

      {/* CTA card */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold text-slate-700">
              Tiến độ của bạn
            </span>
            <span className="text-sm font-bold text-sky-600 tabular-nums">
              {completionPct}%
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-linear-to-r from-sky-400 to-sky-600 transition-all duration-700"
              style={{ width: `${completionPct}%` }}
            />
          </div>
          {completionPct === 100 && (
            <p className="text-xs text-emerald-600 font-medium mt-2 flex items-center gap-1">
              <Award size={12} />
              Bạn đã hoàn thành khóa học. Làm tốt lắm!
            </p>
          )}
        </div>

        {nextLessonId ? (
          <Link href={`/courses/${courseId}/lessons/${nextLessonId}`}>
            <Button className="w-full bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-semibold gap-2 shadow-sm h-10">
              <PlayCircle size={16} />
              {completedCount === 0 ? "Bắt đầu học" : "Tiếp tục học"}
            </Button>
          </Link>
        ) : (
          <Button
            disabled
            className="w-full bg-emerald-500 text-white rounded-xl font-semibold gap-2 h-10 cursor-default"
          >
            <CheckCircle2 size={16} />
            Đã hoàn thành tất cả bài học
          </Button>
        )}
      </div>

      {/* Achievement card (shown when completed) */}
      {completionPct === 100 && (
        <div className="rounded-2xl border border-emerald-200 bg-linear-to-br from-emerald-50 to-sky-50 p-5 text-center space-y-2">
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <Award size={24} className="text-emerald-500" />
            </div>
          </div>
          <p className="text-sm font-bold text-emerald-800">
            Đã hoàn thành khóa học!
          </p>
          <p className="text-xs text-emerald-600">
            Bạn đã hoàn thành toàn bộ bài học trong khóa học này.
          </p>
        </div>
      )}
    </aside>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CourseLearningPage() {
  const params = useParams();
  const courseId = params?.courseId as string;

  const api = useApi();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(
    new Set(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTutorOpen, setIsTutorOpen] = useState(false);

  const fetchLearnData = useCallback(async () => {
    if (!courseId) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await api.get<LearnPageData>(
        `/api/courses/${courseId}/learn`,
      );

      if (res.success && res.data) {
        setCourse(res.data.course);
        setCompletedLessonIds(new Set(res.data.completedLessonIds));
      } else {
        setError(
          res.error ??
            res.message ??
            "Không thể tải dữ liệu học tập của khóa học.",
        );
      }
    } catch {
      setError("Đã xảy ra lỗi khi tải dữ liệu học tập.");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  useEffect(() => {
    fetchLearnData();
  }, [fetchLearnData]);

  // ── Derived stats ───────────────────────────────────────────────────────────
  const totalLessons = useMemo(
    () => course?.modules.reduce((acc, m) => acc + m.lessons.length, 0) ?? 0,
    [course],
  );

  const completedCount = useMemo(
    () =>
      course?.modules.reduce(
        (acc, m) =>
          acc + m.lessons.filter((l) => completedLessonIds.has(l.id)).length,
        0,
      ) ?? 0,
    [course, completedLessonIds],
  );

  const completionPct = useMemo(
    () =>
      totalLessons === 0
        ? 0
        : Math.round((completedCount / totalLessons) * 100),
    [completedCount, totalLessons],
  );

  /**
   * The "next" lesson is the first lesson across all modules (in order)
   * that has NOT been completed. If everything is done, returns null.
   */
  const nextLessonId = useMemo<string | null>(() => {
    if (!course) return null;
    for (const mod of course.modules) {
      for (const lesson of mod.lessons) {
        if (!completedLessonIds.has(lesson.id)) return lesson.id;
      }
    }
    return null;
  }, [course, completedLessonIds]);

  /**
   * Default open accordion value — the module that contains the next lesson,
   * falling back to the first module if everything is complete.
   */
  /**
   * Base UI Accordion `defaultValue` is `string[]` (array).
   * We expand the module containing the next lesson by default,
   * or the first module if all lessons are complete.
   */
  const defaultOpenModule = useMemo<string[]>(() => {
    if (!course || course.modules.length === 0) return [];
    if (nextLessonId) {
      const containing = course.modules.find((m) =>
        m.lessons.some((l) => l.id === nextLessonId),
      );
      return [containing?.id ?? course.modules[0].id];
    }
    return [course.modules[0].id];
  }, [course, nextLessonId]);

  // ── Accordion controlled state ──────────────────────────────────────────────
  const [openModules, setOpenModules] = useState<string[]>([]);
  const [hasInitializedOpenModule, setHasInitializedOpenModule] =
    useState(false);

  useEffect(() => {
    if (!isLoading && !hasInitializedOpenModule) {
      setOpenModules(defaultOpenModule);
      setHasInitializedOpenModule(true);
    }
  }, [isLoading, defaultOpenModule, hasInitializedOpenModule]);

  // ── Render states ───────────────────────────────────────────────────────────

  if (isLoading) return <LearnSkeleton />;

  if (error || !course) {
    return (
      <div
        className={`${CONTENT_CLS} py-24 flex flex-col items-center gap-4 text-center`}
      >
        <div className="h-16 w-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertCircle size={32} className="text-red-400" />
        </div>
        <p className="text-xl font-bold text-slate-800">
          Không tìm thấy khóa học
        </p>
        <p className="text-slate-500 text-sm max-w-sm">
          {error ?? "Khóa học này có thể đã bị xóa hoặc hiện không khả dụng."}
        </p>
        <Link
          href="/courses"
          className="text-sky-600 text-sm hover:underline flex items-center gap-1"
        >
          <ArrowLeft size={14} />
          Quay lại danh mục
        </Link>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 pb-20">
      {/* ══════════════════════════════════════════════════════════════
          HERO STRIP — sky gradient with course title & progress
      ══════════════════════════════════════════════════════════════ */}
      <div className="relative w-full bg-linear-to-br from-sky-700 via-sky-500 to-sky-400 overflow-hidden">
        {/* Blurred thumbnail overlay for depth */}
        {course.thumbnailUrl && (
          <div
            className="absolute inset-0 opacity-10 bg-cover bg-center blur-lg scale-105 pointer-events-none"
            style={{ backgroundImage: `url(${course.thumbnailUrl})` }}
          />
        )}

        <div className={`relative ${CONTENT_CLS} py-10`}>
          {/* Breadcrumb */}
          <nav className="mb-5 flex min-w-0 items-center gap-1.5 overflow-hidden text-xs text-sky-100">
            <Link
              href="/courses"
              className="hover:text-white transition-colors"
            >
              Khóa học
            </Link>
            <ChevronRight size={11} className="opacity-60" />
            <Link
              href={`/courses/${courseId}`}
              className="max-w-[45vw] truncate transition-colors hover:text-white sm:max-w-xs"
            >
              {course.title}
            </Link>
            <ChevronRight size={11} className="opacity-60" />
            <span className="text-white font-medium">Đang học</span>
          </nav>

          {/* Title row */}
          <div className="flex flex-col md:flex-row md:items-end gap-6">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight line-clamp-2">
                {course.title}
              </h1>

              {/* Teacher + stats */}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sky-100 text-sm">
                <span className="flex items-center gap-1.5">
                  <GraduationCap size={14} />
                  {course.teacher.fullName}
                </span>
                <span className="flex items-center gap-1.5">
                  <Layers size={14} />
                  {course.modules.length} học phần · {totalLessons} bài học
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-5 max-w-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sky-100 text-xs font-medium">
                    Tiến độ tổng thể
                  </span>
                  <span className="text-white text-xs font-bold tabular-nums">
                    {completionPct}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-sky-800/50">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-700"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Mobile CTA (shown only on small screens) */}
            <div className="md:hidden">
              {nextLessonId && (
                <Link href={`/courses/${courseId}/lessons/${nextLessonId}`}>
                  <Button className="bg-white text-sky-700 hover:bg-sky-50 rounded-xl px-6 font-semibold gap-2 shadow-md">
                    <PlayCircle size={16} />
                    {completedCount === 0 ? "Bắt đầu" : "Tiếp tục"}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MAIN CONTENT — two-column layout (accordion + sidebar)
      ══════════════════════════════════════════════════════════════ */}
      <div className={`${CONTENT_CLS} pt-8`}>
        <div className="flex w-full min-w-0 max-w-full flex-col items-start gap-8 overflow-x-hidden lg:flex-row">
          {/* ── Left: Curriculum Accordion ── */}
          <section className="w-full min-w-0 max-w-full flex-1 overflow-x-hidden">
            <div className="mb-5 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                Chương trình học
              </h2>
              {totalLessons > 0 && (
                <span className="text-sm text-slate-500">
                  <span className="font-semibold text-slate-700">
                    {completedCount}
                  </span>{" "}
                  / {totalLessons} bài học
                </span>
              )}
            </div>

            {course.modules.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-20 text-center rounded-2xl border border-dashed border-slate-200 bg-white">
                <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center">
                  <Layers size={28} className="text-slate-300" />
                </div>
                <div>
                  <p className="font-semibold text-slate-600">
                    Chưa có học phần nào
                  </p>
                  <p className="text-sm text-slate-400 mt-0.5">
                    Giảng viên chưa thêm nội dung cho khóa học này.
                  </p>
                </div>
              </div>
            ) : (
              <Accordion
                value={openModules}
                onValueChange={setOpenModules}
                className="w-full min-w-0 max-w-full space-y-3 overflow-hidden"
              >
                {course.modules.map((mod, i) => (
                  <ModuleItem
                    key={mod.id}
                    mod={mod}
                    index={i}
                    courseId={courseId}
                    completedLessonIds={completedLessonIds}
                    nextLessonId={nextLessonId}
                  />
                ))}
              </Accordion>
            )}
          </section>

          {/* ── Right: Sidebar (sticky on desktop) ── */}
          <div className="hidden lg:block w-72 xl:w-80 shrink-0 sticky top-24 self-start">
            <CourseSidebar
              courseId={courseId}
              course={course}
              completionPct={completionPct}
              nextLessonId={nextLessonId}
              totalLessons={totalLessons}
              completedCount={completedCount}
            />
          </div>
        </div>
      </div>

      <Sheet open={isTutorOpen} onOpenChange={setIsTutorOpen}>
        <SheetTrigger render={<StickyChatTrigger />} />
        <SheetContent
          side="left"
          className="flex flex-col gap-0 p-0 data-[side=left]:w-full! data-[side=left]:max-w-none! sm:data-[side=left]:w-4/5! lg:data-[side=left]:w-2/3! 2xl:data-[side=left]:w-[60vw]!"
        >
          <ChatWidget courseId={courseId} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
