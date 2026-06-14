"use client";

/**
 * components/CourseCard.tsx
 *
 * Versatile course card used on the Catalog, My Courses, and Manage pages.
 * Mirrors the reference design: large thumbnail, code/category badge
 * top-right, bold title, muted teacher name, status badge, CTA button.
 *
 * Modes (controlled by `variant` prop):
 *   "catalog"  → "View Course" outline button  (public catalog)
 *   "enrolled" → "Continue" sky filled button + progress bar  (student)
 *   "manage"   → "Edit" button + Published/Draft badge  (teacher/admin)
 */

import Link from "next/link";
import { BookOpen, GraduationCap, Users, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CourseCardVariant = "catalog" | "enrolled" | "manage";

export interface CourseCardData {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  isPublished?: boolean;
  teacher?: {
    id: string;
    fullName: string;
  };
  _count?: {
    modules?: number;
    enrollments?: number;
  };
  /** For enrolled variant: 0-100 */
  progress?: number;
  /** For enrolled variant */
  enrollmentStatus?: "ACTIVE" | "COMPLETED" | "DROPPED";
  nextLessonId?: string | null;
}

interface CourseCardProps {
  course: CourseCardData;
  variant?: CourseCardVariant;
  className?: string;
}

// ─── Thumbnail placeholder colours (deterministic by id) ─────────────────────

const THUMB_GRADIENTS = [
  "from-sky-400 to-sky-600",
  "from-violet-400 to-violet-600",
  "from-emerald-400 to-emerald-600",
  "from-amber-400 to-amber-500",
  "from-rose-400 to-rose-600",
  "from-indigo-400 to-indigo-600",
];

function getGradient(id: string): string {
  const idx = id.charCodeAt(0) % THUMB_GRADIENTS.length;
  return THUMB_GRADIENTS[idx];
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({
  course,
  variant,
}: {
  course: CourseCardData;
  variant: CourseCardVariant;
}) {
  if (variant === "manage") {
    return course.isPublished ? (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[11px] font-semibold">
        Đã xuất bản
      </Badge>
    ) : (
      <Badge variant="secondary" className="text-[11px] font-semibold">
        Bản nháp
      </Badge>
    );
  }
  if (variant === "enrolled") {
    const s = course.enrollmentStatus;
    return s === "COMPLETED" ? (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[11px] font-semibold">
        Hoàn thành
      </Badge>
    ) : (
      <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100 text-[11px] font-semibold">
        Đã đăng ký
      </Badge>
    );
  }
  return null;
}

// ─── CTA button ───────────────────────────────────────────────────────────────

function CtaButton({
  course,
  variant,
}: {
  course: CourseCardData;
  variant: CourseCardVariant;
}) {
  const base =
    "w-full rounded-xl font-semibold text-sm transition-all duration-150";
  if (variant === "manage") {
    return (
      <Link href={`/courses/${course.id}/edit`} className="block mt-4">
        <Button
          variant="outline"
          className={cn(
            base,
            "border-sky-300 text-sky-600 hover:bg-sky-50 hover:border-sky-400",
          )}
        >
          Quản lý
        </Button>
      </Link>
    );
  }
  if (variant === "enrolled") {
    const href = course.nextLessonId
      ? `/courses/${course.id}/lessons/${course.nextLessonId}`
      : `/courses/${course.id}/learn`;
    return (
      <Link href={href} className="block mt-4">
        <Button className={cn(base, "bg-sky-500 hover:bg-sky-600 text-white")}>
          Tiếp tục học
        </Button>
      </Link>
    );
  }
  // catalog
  return (
    <Link href={`/courses/${course.id}`} className="block mt-4">
      <Button
        variant="outline"
        className={cn(
          base,
          "border-sky-300 text-sky-600 hover:bg-sky-50 hover:border-sky-400",
        )}
      >
        Xem khóa học
      </Button>
    </Link>
  );
}

// ─── CourseCard ───────────────────────────────────────────────────────────────

export default function CourseCard({
  course,
  variant = "catalog",
  className,
}: CourseCardProps) {
  const gradient = getGradient(course.id);
  const progress = course.progress ?? 0;

  return (
    <Card
      className={cn(
        "group border border-slate-200/80 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 rounded-2xl overflow-hidden bg-white",
        className,
      )}
    >
      {/* ── Thumbnail ── */}
      <Link
        href={`/courses/${course.id}`}
        className="block relative aspect-video overflow-hidden bg-slate-100"
      >
        {course.thumbnailUrl ? (
          <img
            src={course.thumbnailUrl}
            alt={course.title}
            className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div
            className={cn(
              "h-full w-full bg-linear-to-br flex items-center justify-center",
              gradient,
            )}
          >
            <BookOpen size={36} className="text-white/80" />
          </div>
        )}

        {/* Status badge overlay (top-right, mirroring reference code badge) */}
        {variant !== "catalog" && (
          <div className="absolute top-2.5 right-2.5">
            <StatusBadge course={course} variant={variant} />
          </div>
        )}
      </Link>

      {/* ── Content ── */}
      <CardContent className="p-4 flex flex-col">
        {/* Title */}
        <Link href={`/courses/${course.id}`}>
          <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-2 hover:text-sky-600 transition-colors">
            {course.title}
          </h3>
        </Link>

        {/* Teacher */}
        {course.teacher && (
          <p className="mt-1.5 text-sm text-slate-500 flex items-center gap-1.5">
            <GraduationCap size={13} className="shrink-0 text-slate-400" />
            <span className="truncate">{course.teacher.fullName}</span>
          </p>
        )}

        {/* Meta row */}
        {course._count && (
          <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
            {course._count.modules !== undefined && (
              <span className="flex items-center gap-1">
                <Layers size={11} />
                {course._count.modules} học phần
              </span>
            )}
            {course._count.enrollments !== undefined &&
              variant !== "catalog" && (
                <span className="flex items-center gap-1">
                  <Users size={11} />
                  {course._count.enrollments} sinh viên
                </span>
              )}
          </div>
        )}

        {/* Progress bar (enrolled only) */}
        {variant === "enrolled" && (
          <div className="mt-3 flex items-center gap-2">
            <Progress value={progress} className="h-1.5 flex-1" />
            <span className="text-[11px] font-semibold text-slate-500 shrink-0 w-8 text-right">
              {progress}%
            </span>
          </div>
        )}

        {/* CTA */}
        <CtaButton course={course} variant={variant} />
      </CardContent>
    </Card>
  );
}
