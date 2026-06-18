"use client";

/**
 * components/dashboard/StudentDashboard.tsx
 *
 * Student-facing dashboard. Shows:
 *   - Welcome hero with personalised greeting
 *   - Three stat cards (Enrolled / Completed / Overall progress)
 *   - "Continue Learning" list — real progress from the API
 *   - "Discover more" CTA card
 *
 * Data: GET /api/enrollments/my?status=ACTIVE
 *   → returns { progress, nextLessonId, course } per enrollment
 *   (real values computed in enrollment.service.ts)
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookMarked,
  CheckCircle2,
  TrendingUp,
  BookOpen,
  ArrowRight,
  GraduationCap,
  PlayCircle,
  Award,
  Flame,
  Layers,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnrollmentItem {
  id: string;
  status: "ACTIVE" | "COMPLETED" | "DROPPED";
  progress: number;
  nextLessonId: string | null;
  course: {
    id: string;
    title: string;
    thumbnailUrl?: string | null;
    teacher: { fullName: string };
    _count: { modules: number };
  };
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  icon: Icon,
  colorClass,
  bgClass,
  label,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
  label?: string;
}) {
  return (
    <Card className="border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow duration-200 bg-white">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              {title}
            </p>
            <p className="mt-1.5 text-3xl font-extrabold text-slate-900 tabular-nums">
              {value}
            </p>
            {label && (
              <p className="mt-1 text-xs text-slate-400 font-medium">{label}</p>
            )}
          </div>
          <div
            className={`h-12 w-12 rounded-2xl ${bgClass} flex items-center justify-center shadow-sm`}
          >
            <Icon className={colorClass} size={22} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Continue Learning Card ────────────────────────────────────────────────────

function LearningCard({ enrollment }: { enrollment: EnrollmentItem }) {
  const href = enrollment.nextLessonId
    ? `/courses/${enrollment.course.id}/lessons/${enrollment.nextLessonId}`
    : `/courses/${enrollment.course.id}/learn`;

  return (
    <Card className="border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 group bg-white">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Thumbnail */}
          <div className="h-14 w-18 rounded-xl bg-linear-to-br from-sky-400 to-sky-600 flex items-center justify-center shrink-0 overflow-hidden">
            {enrollment.course.thumbnailUrl ? (
              <img
                src={enrollment.course.thumbnailUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <BookOpen size={22} className="text-white" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate leading-snug">
              {enrollment.course.title}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              by {enrollment.course.teacher.fullName}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Progress value={enrollment.progress} className="h-1.5 flex-1" />
              <span className="text-xs font-semibold text-slate-600 shrink-0 tabular-nums w-9 text-right">
                {enrollment.progress}%
              </span>
            </div>
          </div>

          {/* CTA — appears on hover */}
          <Link href={href} className="shrink-0">
            <Button
              size="sm"
              className="bg-sky-500 hover:bg-sky-600 text-white gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
            >
              <PlayCircle size={13} />
              {enrollment.progress === 0 ? "Bắt đầu" : "Tiếp tục"}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StudentDashboard({ fullName }: { fullName: string }) {
  const api = useApi();
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<EnrollmentItem[]>("/api/enrollments/my")
      .then((res) => {
        if (res.success && res.data) setEnrollments(res.data);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = enrollments.filter((e) => e.status === "ACTIVE");
  const completed = enrollments.filter((e) => e.status === "COMPLETED");

  // Average progress across active courses
  const avgProgress =
    active.length === 0
      ? 0
      : Math.round(active.reduce((s, e) => s + e.progress, 0) / active.length);

  const firstName = fullName.split(" ")[0];

  return (
    <div className="mx-auto px-6 md:px-12 lg:px-24 max-w-7xl py-10">
      <div className="space-y-8 max-w-5xl">
        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* ── Welcome hero ── */}
            <div className="rounded-2xl bg-linear-to-br from-sky-500 via-sky-500 to-sky-600 p-6 text-white shadow-lg overflow-hidden relative">
              {/* Decorative circle */}
              <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10" />
              <div className="absolute -right-2 -bottom-6 h-24 w-24 rounded-full bg-white/8" />

              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-sky-100 text-sm font-medium flex items-center gap-1.5">
                    <Flame size={13} className="text-amber-300" />
                    Chào mừng bạn trở lại,
                  </p>
                  <h2 className="mt-1 text-2xl md:text-3xl font-bold">
                    {firstName}! 👋
                  </h2>
                  <p className="mt-1.5 text-sky-100 text-sm max-w-sm">
                    {active.length === 0
                      ? "Bắt đầu hành trình học tập bằng cách khám phá các khóa học bên dưới."
                      : avgProgress >= 75
                        ? "Bạn sắp hoàn thành rồi, hãy tiếp tục nhé!"
                        : "Giữ vững nhịp học, bạn đang làm rất tốt!"}
                  </p>
                </div>
                <div className="hidden sm:flex h-20 w-20 rounded-2xl bg-white/15 items-center justify-center shrink-0">
                  <GraduationCap size={36} className="text-white" />
                </div>
              </div>
            </div>

            {/* ── Stat cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                title="Khóa học đã đăng ký"
                value={active.length}
                icon={BookMarked}
                colorClass="text-sky-600"
                bgClass="bg-sky-50"
                label="Đang học"
              />
              <StatCard
                title="Hoàn thành"
                value={completed.length}
                icon={CheckCircle2}
                colorClass="text-emerald-600"
                bgClass="bg-emerald-50"
                label="Chứng chỉ đạt được"
              />
              <StatCard
                title="Tiến độ trung bình"
                value={`${avgProgress}%`}
                icon={TrendingUp}
                colorClass="text-violet-600"
                bgClass="bg-violet-50"
                label="Trên các khóa đang học"
              />
            </div>

            {/* ── Continue Learning ── */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <PlayCircle size={16} className="text-sky-500" />
                  Tiếp tục học
                </h3>
                <Link href="/my-courses">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-sky-600 gap-1 hover:text-sky-700 hover:bg-sky-50"
                  >
                    Xem tất cả <ArrowRight size={14} />
                  </Button>
                </Link>
              </div>

              {active.length === 0 ? (
                <Card className="border-2 border-dashed border-slate-200 shadow-none bg-white">
                  <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
                    <div className="h-14 w-14 rounded-2xl bg-sky-50 flex items-center justify-center">
                      <BookOpen size={28} className="text-sky-300" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">
                        Chưa có khóa học đang học
                      </p>
                      <p className="text-slate-400 text-sm mt-0.5">
                        Đăng ký một khóa học để bắt đầu
                      </p>
                    </div>
                    <Link href="/courses">
                      <Button
                        size="sm"
                        className="bg-sky-500 hover:bg-sky-600 text-white mt-1"
                      >
                        Duyệt khóa học
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {active.slice(0, 4).map((enrollment) => (
                    <LearningCard key={enrollment.id} enrollment={enrollment} />
                  ))}
                  {active.length > 4 && (
                    <p className="text-center text-xs text-slate-400 pt-1">
                      +{active.length - 4} khóa học khác trong{" "}
                      <Link
                        href="/my-courses"
                        className="text-sky-500 hover:underline"
                      >
                        Khóa học của tôi
                      </Link>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* ── Completed courses badge ── */}
            {completed.length > 0 && (
              <Card className="border border-emerald-200 bg-linear-to-br from-emerald-50 to-sky-50 shadow-sm">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <Award size={24} className="text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-emerald-800">
                      🎉 Bạn đã hoàn thành {completed.length} khóa học!
                    </p>
                    <p className="text-emerald-600 text-sm mt-0.5">
                      Tuyệt vời — hãy tiếp tục trau dồi kỹ năng mới.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Discover more ── */}
            <Card className="border-0 bg-slate-900 shadow-lg">
              <CardContent className="p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-white font-semibold">
                    Khám phá khóa học mới
                  </p>
                  <p className="text-slate-400 text-sm mt-0.5">
                    Mở rộng kiến thức ngay hôm nay
                  </p>
                </div>
                <Link href="/courses">
                  <Button className="bg-sky-500 hover:bg-sky-600 text-white gap-1.5 shrink-0">
                    <Layers size={15} />
                    Duyệt
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
