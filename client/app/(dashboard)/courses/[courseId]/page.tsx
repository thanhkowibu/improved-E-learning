"use client";

/**
 * app/(dashboard)/courses/[courseId]/page.tsx
 *
 * Course Detail Page.
 *
 * Layout:
 *  ┌─────────────────────────────────────────────────────────────────┐
 *  │  HERO — full-viewport-width sky gradient                        │
 *  │  content inside: max-w-7xl mx-auto px-6 md:px-12 lg:px-24      │
 *  │  (aligns with navbar logo)                                      │
 *  └─────────────────────────────────────────────────────────────────┘
 *  ┌─────────────────────────────────────────────────────────────────┐
 *  │  Sticky tab row — same horizontal alignment                     │
 *  ├─────────────────────────────────────────────────────────────────┤
 *  │  Tab content — same horizontal alignment, py-10                 │
 *  └─────────────────────────────────────────────────────────────────┘
 */

import { useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  GraduationCap,
  Users,
  Layers,
  CheckCircle2,
  BookOpen,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useCourseDetail } from "@/hooks/useCourseDetail";
import { useAuth } from "@/hooks/useAuth";
import EnrollButton from "@/components/EnrollButton";
import { CourseStudentsTable } from "@/components/courses/CourseStudentsTable";
import { CourseQuizAnalytics } from "@/components/analytics/CourseQuizAnalytics";
import type { ModuleSummary } from "@/hooks/useCourseDetail";

// Shared horizontal padding — matches the Navbar container exactly.
const CONTENT_CLS = "mx-auto px-6 md:px-12 lg:px-24 max-w-7xl";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div>
      <div className="bg-slate-200 animate-pulse h-72 w-full" />
      <div className={`${CONTENT_CLS} py-10 space-y-4`}>
        <Skeleton className="h-8 w-2/3 rounded-xl" />
        <Skeleton className="h-5 w-1/2 rounded-xl" />
        <Skeleton className="h-5 w-1/3 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Module Accordion ─────────────────────────────────────────────────────────

function ModuleAccordion({
  mod,
  index,
}: {
  mod: ModuleSummary;
  index: number;
}) {
  const [open, setOpen] = useState(index === 0);

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="h-7 w-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center text-xs font-bold shrink-0">
            {index + 1}
          </span>
          <span className="font-semibold text-slate-900 text-sm">
            {mod.title}
          </span>
          <span className="text-xs text-slate-400 ml-1">
            {mod.lessons.length} bài học
          </span>
        </div>
        <ChevronDown
          size={16}
          className={cn(
            "text-slate-400 transition-transform duration-200 shrink-0",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="border-t border-slate-100 divide-y divide-slate-50">
          {mod.lessons.length === 0 ? (
            <p className="px-5 py-3 text-sm text-slate-400 italic">
              Chưa có bài học.
            </p>
          ) : (
            mod.lessons.map((lesson) => (
              <div
                key={lesson.id}
                className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 transition-colors"
              >
                <CheckCircle2 size={15} className="text-sky-400 shrink-0" />
                <span className="text-sm text-slate-700">{lesson.title}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = "overview" | "curriculum" | "teacher" | "students" | "analytics";
const BASE_TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Tổng quan" },
  { id: "curriculum", label: "Chương trình học" },
  { id: "teacher", label: "Giảng viên" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CourseDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const courseId = params?.courseId as string;
  const { course, enrollmentStatus, isLoading, error, refetchEnrollment } =
    useCourseDetail(courseId);
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>(
    searchParams.get("tab") === "analytics" ? "analytics" : "overview",
  );

  const totalLessons =
    course?.modules.reduce((acc, m) => acc + m.lessons.length, 0) ?? 0;
  const canManageCourse =
    user?.role === "ADMIN" ||
    (user?.role === "TEACHER" && user.id === course?.teacherId);
  const tabs = canManageCourse
    ? [
        ...BASE_TABS,
        { id: "students" as const, label: "Sinh viên" },
        { id: "analytics" as const, label: "Thống kê quiz" },
      ]
    : BASE_TABS;

  if (isLoading) return <DetailSkeleton />;

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
        <p className="text-slate-500 text-sm">
          {error ?? "Khóa học có thể đã bị xóa hoặc chưa được xuất bản."}
        </p>
        <Link href="/courses" className="text-sky-600 text-sm hover:underline">
          ← Quay lại danh mục
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-16">
      {/* ══════════════════════════════════════════
          HERO — full-width background
      ══════════════════════════════════════════ */}
      <div
        className={cn(
          "relative w-full overflow-hidden animate-bg-pan",
          course.thumbnailUrl
            ? "bg-slate-950"
            : "bg-linear-to-br from-sky-500 via-25% via-sky-400 to-cyan-400",
        )}
      >
        {/* Thumbnail backdrop */}
        {course.thumbnailUrl && (
          <>
            <div
              className="pointer-events-none absolute inset-0 scale-105 bg-cover bg-center brightness-50"
              style={{ backgroundImage: `url(${course.thumbnailUrl})` }}
            />
            <div className="pointer-events-none absolute inset-0 bg-slate-950/45" />
          </>
        )}

        {/* Content — same padding as Navbar */}
        <div className={`relative ${CONTENT_CLS} py-12`}>
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* ── Left: text ── */}
            <div className="flex-1 min-w-0">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-1 text-sky-100 text-xs mb-5">
                <Link
                  href="/courses"
                  className="hover:text-white transition-colors"
                >
                  Khóa học
                </Link>
                <ChevronRight size={12} />
                <span className="text-white font-medium truncate max-w-xs">
                  {course.title}
                </span>
              </nav>

              {!course.isPublished && (
                <Badge className="mb-3 bg-amber-400 text-amber-900 hover:bg-amber-400 text-xs font-semibold">
                  Bản nháp — Chưa xuất bản
                </Badge>
              )}

              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
                {course.title}
              </h1>

              {course.description && (
                <p className="mt-3 text-sky-100 text-base leading-relaxed max-w-2xl line-clamp-3">
                  {course.description}
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-4 text-sky-100 text-sm">
                <Link
                  href={`/profile/${course.teacher.id}`}
                  className="flex items-center gap-1.5 hover:text-white hover:underline"
                >
                  <GraduationCap size={15} /> {course.teacher.fullName}
                </Link>
                <span className="flex items-center gap-1.5">
                  <Users size={15} /> {course._count.enrollments} sinh viên
                </span>
                <span className="flex items-center gap-1.5">
                  <Layers size={15} /> {course._count.modules} học phần ·{" "}
                  {totalLessons} bài học
                </span>
              </div>

              <div className="mt-7">
                <EnrollButton
                  courseId={courseId}
                  enrollmentStatus={enrollmentStatus}
                  onStatusChange={refetchEnrollment}
                />
              </div>
            </div>

            {/* ── Right: thumbnail / teacher card ── */}
            <div className="shrink-0 w-full md:w-64">
              <div className="rounded-2xl overflow-hidden shadow-2xl bg-white">
                {course.thumbnailUrl ? (
                  <img
                    src={course.thumbnailUrl}
                    alt={course.title}
                    className="w-full aspect-video object-cover"
                  />
                ) : (
                  <div className="w-full aspect-video bg-linear-to-br from-sky-500 via-25% via-sky-400 to-cyan-400 flex items-center justify-center animate-bg-pan">
                    <BookOpen size={40} className="text-white/80" />
                  </div>
                )}
                <div className="p-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">
                    Giảng viên
                  </p>
                  <Link
                    href={`/profile/${course.teacher.id}`}
                    className="flex items-center gap-3 rounded-xl transition-colors hover:text-sky-600 hover:underline"
                  >
                    <Avatar className="h-9 w-9 shrink-0 shadow-sm">
                      <AvatarImage
                        src={course.teacher.avatarUrl ?? undefined}
                        alt={course.teacher.fullName}
                      />
                      <AvatarFallback className="bg-linear-to-br from-sky-500 via-25% via-sky-400 to-cyan-400 text-xs font-bold text-white">
                        {course.teacher.fullName
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {course.teacher.fullName}
                      </p>
                      <p className="text-xs text-slate-500">Giảng viên</p>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          STICKY TAB ROW — same horizontal padding
      ══════════════════════════════════════════ */}
      <div className="sticky top-16 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className={CONTENT_CLS}>
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative px-4 py-4 text-sm font-semibold transition-colors",
                  activeTab === tab.id
                    ? "text-sky-600"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          TAB CONTENT — same horizontal padding
      ══════════════════════════════════════════ */}
      <div className={`${CONTENT_CLS} py-10`}>
        {/* Overview */}
        {activeTab === "overview" && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-3">
                Về khóa học này
              </h2>
              {course.description ? (
                <p className="text-slate-600 leading-relaxed text-base whitespace-pre-wrap">
                  {course.description}
                </p>
              ) : (
                <p className="text-slate-400 italic text-sm">Chưa có mô tả.</p>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                {
                  label: "Học phần",
                  value: course.modules?.length || 0,
                  icon: Layers,
                },
                { label: "Bài học", value: totalLessons, icon: BookOpen },
                {
                  label: "Sinh viên",
                  value: course._count.enrollments,
                  icon: Users,
                },
              ].map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-2xl bg-slate-50 border border-slate-200 p-4 flex flex-col gap-1"
                >
                  <Icon size={18} className="text-sky-500" />
                  <p className="text-2xl font-bold text-slate-900">{value}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Curriculum */}
        {activeTab === "curriculum" && (
          <div className="max-w-3xl">
            <h2 className="text-xl font-bold text-slate-900 mb-5">
              Chương trình học
            </h2>
            {course.modules.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Layers size={32} className="text-slate-300" />
                <p className="text-slate-400 text-sm">Chưa có học phần nào.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {course.modules.map((mod, i) => (
                  <ModuleAccordion key={mod.id} mod={mod} index={i} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Instructor */}
        {activeTab === "teacher" && (
          <div className="max-w-xl">
            <h2 className="text-xl font-bold text-slate-900 mb-5">
              Giảng viên
            </h2>
            <Link
              href={`/profile/${course.teacher.id}`}
              className="flex items-center gap-5 rounded-2xl border border-slate-200 bg-white p-6 transition-colors hover:border-sky-200 hover:bg-sky-50/40"
            >
              <Avatar className="h-16 w-16 shrink-0 shadow-md">
                <AvatarImage
                  src={course.teacher.avatarUrl ?? undefined}
                  alt={course.teacher.fullName}
                />
                <AvatarFallback className="bg-linear-to-br from-sky-500 via-25% via-sky-400 to-cyan-400 text-xl font-bold text-white">
                  {course.teacher.fullName
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-bold text-slate-900">
                  {course.teacher.fullName}
                </p>
                <p className="text-sm text-slate-500 mt-0.5">
                  Giảng viên khóa học
                </p>
                <Badge className="mt-2 bg-sky-100 text-sky-700 hover:bg-sky-100 text-xs">
                  Giảng viên
                </Badge>
              </div>
            </Link>
          </div>
        )}

        {/* Students */}
        {activeTab === "students" && canManageCourse && (
          <CourseStudentsTable courseId={course.id} />
        )}

        {/* Quiz analytics */}
        {activeTab === "analytics" && canManageCourse && (
          <CourseQuizAnalytics courseId={course.id} />
        )}
      </div>
    </div>
  );
}
