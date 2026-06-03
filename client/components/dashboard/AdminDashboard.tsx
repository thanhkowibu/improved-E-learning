"use client";

/**
 * components/dashboard/AdminDashboard.tsx
 *
 * Admin-facing dashboard. Shows:
 *   - Dark hero header
 *   - Four platform-wide stat cards (Users / Courses / Published / Enrollments)
 *   - Recent registrations table (last 5 users)
 *   - Recent courses feed (last 5 courses)
 *   - Quick actions panel
 *
 * Data: GET /api/users?limit=5 + GET /api/courses?limit=5
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
  Users,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  ArrowRight,
  BarChart3,
  ShieldCheck,
  Settings,
  PlusCircle,
  Clock,
  TrendingUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserItem {
  id: string;
  fullName: string;
  email: string;
  role: "ADMIN" | "TEACHER" | "STUDENT";
  isActive: boolean;
  createdAt: string;
}

interface CourseItem {
  id: string;
  title: string;
  isPublished: boolean;
  teacher: { fullName: string };
  _count: { enrollments: number };
}

interface StatsData {
  totalUsers: number;
  totalCourses: number;
  publishedCourses: number;
  totalEnrollments: number;
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

// ─── Role badge colours ───────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, string> = {
  ADMIN: "bg-violet-100 text-violet-700 hover:bg-violet-100",
  TEACHER: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  STUDENT: "bg-sky-100 text-sky-700 hover:bg-sky-100",
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminDashboard({ fullName }: { fullName: string }) {
  const api = useApi();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ items: UserItem[]; total: number }>("/api/users?limit=5"),
      api.get<{ items: CourseItem[]; total: number; }>("/api/courses?limit=5"),
      api.get<{ items: UserItem[]; total: number }>("/api/users?limit=1"),
      api.get<{ items: CourseItem[]; total: number }>("/api/courses?limit=1"),
    ])
      .then(([uRes, cRes, uTotal, cTotal]) => {
        if (uRes.success && uRes.data) setUsers(uRes.data.items);
        if (cRes.success && cRes.data) setCourses(cRes.data.items);

        // Build stats from what we have
        const allCourses = cRes.success && cRes.data ? cRes.data.items : [];
        setStats({
          totalUsers: uTotal.success && uTotal.data ? uTotal.data.total : 0,
          totalCourses: cTotal.success && cTotal.data ? cTotal.data.total : 0,
          publishedCourses: allCourses.filter((c) => c.isPublished).length,
          totalEnrollments: allCourses.reduce(
            (acc, c) => acc + c._count.enrollments,
            0
          ),
        });
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto px-6 md:px-12 lg:px-24 max-w-7xl py-10">
      <div className="space-y-8 max-w-6xl">
        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* ── Hero header ── */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 p-6 text-white shadow-lg overflow-hidden relative">
              <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/5" />
              <div className="absolute -right-2 -bottom-8 h-24 w-24 rounded-full bg-white/5" />
              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-sky-400" />
                    Admin Control Panel
                  </p>
                  <h2 className="mt-1 text-2xl font-bold">{fullName}</h2>
                  <p className="mt-1 text-slate-400 text-sm">
                    Platform overview &amp; management
                  </p>
                </div>
                <div className="hidden sm:flex h-16 w-16 rounded-2xl bg-white/10 items-center justify-center shrink-0">
                  <BarChart3 size={30} className="text-white" />
                </div>
              </div>
            </div>

            {/* ── Stat cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Users"
                value={stats?.totalUsers ?? "—"}
                icon={Users}
                colorClass="text-violet-600"
                bgClass="bg-violet-50"
                label="Platform-wide"
              />
              <StatCard
                title="Total Courses"
                value={stats?.totalCourses ?? "—"}
                icon={BookOpen}
                colorClass="text-sky-600"
                bgClass="bg-sky-50"
                label="All courses"
              />
              <StatCard
                title="Published"
                value={stats?.publishedCourses ?? "—"}
                icon={CheckCircle2}
                colorClass="text-emerald-600"
                bgClass="bg-emerald-50"
                label="Live courses"
              />
              <StatCard
                title="Enrollments"
                value={stats?.totalEnrollments ?? "—"}
                icon={GraduationCap}
                colorClass="text-amber-600"
                bgClass="bg-amber-50"
                label="Total student-course"
              />
            </div>

            {/* ── Two columns ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Recent Users */}
              <Card className="border border-slate-200/80 shadow-sm bg-white overflow-hidden">
                <CardHeader className="px-5 py-4 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <Users size={16} className="text-violet-500" />
                      Recent Registrations
                    </CardTitle>
                    <Link href="/admin/users">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-500 gap-1 hover:text-slate-700 text-xs"
                      >
                        Manage all <ArrowRight size={12} />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <div className="divide-y divide-slate-100">
                  {users.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-slate-400 text-center">
                      No users found.
                    </p>
                  ) : (
                    users.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {user.fullName
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {user.fullName}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {user.email}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge
                            className={`text-[10px] font-semibold ${ROLE_BADGE[user.role] ?? ""}`}
                          >
                            {user.role}
                          </Badge>
                          {!user.isActive && (
                            <Badge className="text-[10px] bg-red-100 text-red-600 hover:bg-red-100">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              {/* Recent Courses */}
              <Card className="border border-slate-200/80 shadow-sm bg-white overflow-hidden">
                <CardHeader className="px-5 py-4 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <BookOpen size={16} className="text-sky-500" />
                      Recent Courses
                    </CardTitle>
                    <Link href="/courses">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-500 gap-1 hover:text-slate-700 text-xs"
                      >
                        Browse all <ArrowRight size={12} />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <div className="divide-y divide-slate-100">
                  {courses.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-slate-400 text-center">
                      No courses found.
                    </p>
                  ) : (
                    courses.map((course) => (
                      <div
                        key={course.id}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="h-8 w-8 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
                          <BookOpen size={14} className="text-sky-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {course.title}
                          </p>
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Users size={10} />
                            {course._count.enrollments} enrolled ·{" "}
                            {course.teacher.fullName}
                          </p>
                        </div>
                        <Badge
                          className={
                            course.isPublished
                              ? "text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100 font-semibold shrink-0"
                              : "text-[10px] bg-slate-100 text-slate-500 hover:bg-slate-100 font-semibold shrink-0"
                          }
                        >
                          {course.isPublished ? "Live" : "Draft"}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            {/* ── Quick Actions ── */}
            <Card className="border border-slate-200/80 shadow-sm bg-white">
              <CardHeader className="px-5 py-4 border-b border-slate-100">
                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Settings size={16} className="text-slate-500" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="flex flex-wrap gap-3">
                  <Link href="/admin/users">
                    <Button
                      variant="outline"
                      className="gap-2 border-slate-200 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 transition-colors"
                    >
                      <Users size={14} />
                      Manage Users
                    </Button>
                  </Link>
                  <Link href="/courses">
                    <Button
                      variant="outline"
                      className="gap-2 border-slate-200 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 transition-colors"
                    >
                      <BookOpen size={14} />
                      Browse Courses
                    </Button>
                  </Link>
                  <Link href="/courses/new">
                    <Button className="gap-2 bg-sky-500 hover:bg-sky-600 text-white">
                      <PlusCircle size={14} />
                      Create Course
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
