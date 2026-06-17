"use client";

/**
 * components/dashboard/TeacherDashboard.tsx
 *
 * Teacher-facing dashboard. Shows:
 *   - Header with quick "Create Course" CTA
 *   - Summary metric cards (Published Courses / Total Students / Drafts)
 *   - My Courses list with Edit button and per-course stats
 *   - Revenue/engagement placeholder for future analytics
 *
 * Data: GET /api/courses  (teacher only sees their own)
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  PlusCircle,
  ArrowRight,
  Users,
  Layers,
  Pencil,
  TrendingUp,
  CheckCircle2,
  Eye,
  BarChart3,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CourseItem {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  isPublished: boolean;
  createdAt: string;
  _count: { enrollments: number; modules: number };
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
    <Card className="border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow bg-white">
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

// ─── Course Row ───────────────────────────────────────────────────────────────

function CourseRow({ course }: { course: CourseItem }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors group">
      {/* Thumbnail */}
      <div className="h-11 w-16 rounded-xl bg-linear-to-br from-sky-400 to-sky-600 flex items-center justify-center shrink-0 overflow-hidden">
        {course.thumbnailUrl ? (
          <img
            src={course.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <BookOpen size={16} className="text-white" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-900 truncate">
            {course.title}
          </p>
          <Badge
            className={
              course.isPublished
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px] font-semibold shrink-0"
                : "bg-slate-100 text-slate-500 hover:bg-slate-100 text-[10px] font-semibold shrink-0"
            }
          >
            {course.isPublished ? "Đã xuất bản" : "Bản nháp"}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Users size={11} />
            {course._count.enrollments} sinh viên
          </span>
          <span className="flex items-center gap-1">
            <Layers size={11} />
            {course._count.modules} học phần
          </span>
        </div>
      </div>

      {/* Actions — visible on hover */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Link href={`/courses/${course.id}`}>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-slate-500 hover:text-slate-700"
          >
            <Eye size={14} />
          </Button>
        </Link>
        <Link href={`/courses/${course.id}/edit`}>
          <Button
            size="sm"
            className="h-8 px-3 bg-sky-500 hover:bg-sky-600 text-white gap-1.5"
          >
            <Pencil size={12} />
            Sửa
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-20 w-full rounded-2xl" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TeacherDashboard({ fullName }: { fullName: string }) {
  const api = useApi();
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ items: CourseItem[] }>("/api/courses?limit=100")
      .then((res) => {
        if (res.success && res.data) setCourses(res.data.items);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const published = courses.filter((c) => c.isPublished);
  const drafts = courses.filter((c) => !c.isPublished);
  const totalStudents = courses.reduce(
    (acc, c) => acc + c._count.enrollments,
    0,
  );
  const firstName = fullName.split(" ")[0];

  return (
    <div className="mx-auto px-6 md:px-12 lg:px-24 max-w-7xl py-10">
      <div className="space-y-8 max-w-5xl">
        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* ── Header ── */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">
                  Hello, {firstName} 👨‍🏫
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  Quản lý khóa học và theo dõi tiến độ học tập của sinh viên.
                </p>
              </div>
              <Link href="/courses/new">
                <Button className="bg-sky-500 hover:bg-sky-600 text-white gap-2 shadow-sm font-semibold">
                  <PlusCircle size={16} />
                  Tạo khóa học
                </Button>
              </Link>
            </div>

            {/* ── Stat cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                title="Khóa học đã xuất bản"
                value={published.length}
                icon={CheckCircle2}
                colorClass="text-sky-600"
                bgClass="bg-sky-50"
                label="Đang mở cho sinh viên"
              />
              <StatCard
                title="Tổng sinh viên"
                value={totalStudents}
                icon={Users}
                colorClass="text-violet-600"
                bgClass="bg-violet-50"
                label="Trên toàn bộ khóa học"
              />
              <StatCard
                title="Khóa học nháp"
                value={drafts.length}
                icon={BookOpen}
                colorClass="text-amber-600"
                bgClass="bg-amber-50"
                label="Chưa xuất bản"
              />
            </div>

            {/* ── Courses list ── */}
            <Card className="border border-slate-200/80 shadow-sm bg-white overflow-hidden">
              <CardHeader className="px-5 py-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <Layers size={16} className="text-sky-500" />
                    Khóa học của tôi
                  </CardTitle>
                  <Link href="/my-courses">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-sky-600 gap-1 hover:text-sky-700 hover:bg-sky-50 text-xs"
                    >
                      Quản lý tất cả <ArrowRight size={13} />
                    </Button>
                  </Link>
                </div>
              </CardHeader>

              {courses.length === 0 ? (
                <CardContent className="py-16 flex flex-col items-center gap-4 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center">
                    <Layers size={28} className="text-slate-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700">
                      Chưa có khóa học
                    </p>
                    <p className="text-slate-400 text-sm mt-0.5">
                      Tạo khóa học đầu tiên để bắt đầu.
                    </p>
                  </div>
                  <Link href="/courses/new">
                    <Button
                      size="sm"
                      className="bg-sky-500 hover:bg-sky-600 text-white gap-1.5"
                    >
                      <PlusCircle size={14} />
                      Khóa học mới
                    </Button>
                  </Link>
                </CardContent>
              ) : (
                <div className="divide-y divide-slate-100">
                  {courses.slice(0, 8).map((course) => (
                    <CourseRow key={course.id} course={course} />
                  ))}
                </div>
              )}
            </Card>

            {/* ── Analytics CTA ── */}
            {courses.length > 0 && (
              <Card className="border border-sky-200 bg-linear-to-br from-sky-50 to-white shadow-sm">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-sky-100 flex items-center justify-center shrink-0">
                    <BarChart3 size={22} className="text-sky-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">
                      {totalStudents} sinh viên đã đăng ký các khóa học của bạn
                    </p>
                    <p className="text-slate-500 text-sm mt-0.5 flex items-center gap-1.5">
                      <TrendingUp size={12} className="text-emerald-500" />
                      {published.length} đã xuất bản · {drafts.length} bản nháp
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
