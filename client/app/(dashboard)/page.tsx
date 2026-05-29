"use client";

/**
 * app/(dashboard)/page.tsx  →  /dashboard
 *
 * Role-aware dashboard. Renders different content based on user.role:
 *
 *  STUDENT  → Welcome + Stats (enrolled, completed) + Continue Learning section
 *  TEACHER  → Stats (active courses, total students) + Create Course CTA
 *  ADMIN    → Platform-wide stats + Recent registrations table
 *
 * Data is fetched from our own API routes using the useApi hook.
 * Shadcn Card, Badge, Progress, Table, Button, Separator are used for polish.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";

// Shadcn components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// Icons
import {
  BookMarked,
  CheckCircle2,
  TrendingUp,
  Users,
  BookOpen,
  PlusCircle,
  ArrowRight,
  GraduationCap,
  Layers,
  Clock,
  BarChart3,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  change?: string;
}

interface EnrollmentItem {
  id: string;
  status: string;
  enrolledAt: string;
  course: {
    id: string;
    title: string;
    thumbnailUrl?: string;
    teacher: { fullName: string };
    _count: { modules: number };
  };
}

interface CourseItem {
  id: string;
  title: string;
  thumbnailUrl?: string;
  isPublished: boolean;
  _count: { enrollments: number; modules: number };
}

interface UserItem {
  id: string;
  fullName: string;
  email: string;
  role: string;
  createdAt: string;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ title, value, icon: Icon, color, bgColor, change }: StatCardProps) {
  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              {title}
            </p>
            <p className="mt-1.5 text-3xl font-bold text-slate-900">{value}</p>
            {change && (
              <p className="mt-1 text-xs text-emerald-600 font-medium flex items-center gap-1">
                <TrendingUp size={11} />
                {change}
              </p>
            )}
          </div>
          <div className={`h-12 w-12 rounded-2xl ${bgColor} flex items-center justify-center shadow-sm`}>
            <Icon className={color} size={22} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Student Dashboard ────────────────────────────────────────────────────────

function StudentDashboard({ fullName }: { fullName: string }) {
  const api = useApi();
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<EnrollmentItem[]>("/api/enrollments/my").then((res) => {
      if (res.success && res.data) setEnrollments(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = enrollments.filter((e) => e.status === "ACTIVE");
  const completed = enrollments.filter((e) => e.status === "COMPLETED");

  return (
    <div className="mx-auto px-6 md:px-12 lg:px-24 max-w-7xl py-10">
    <div className="space-y-8 max-w-5xl">
      {/* Welcome header */}
      <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sky-100 text-sm font-medium">Welcome back 👋</p>
            <h2 className="mt-1 text-2xl font-bold">{fullName}</h2>
            <p className="mt-1 text-sky-100 text-sm">
              Keep up the momentum — you&apos;re doing great!
            </p>
          </div>
          <div className="hidden sm:flex h-20 w-20 rounded-2xl bg-white/15 items-center justify-center">
            <GraduationCap size={36} className="text-white" />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Enrolled Courses"
          value={loading ? "—" : active.length}
          icon={BookMarked}
          color="text-sky-600"
          bgColor="bg-sky-50"
          change="Your active courses"
        />
        <StatCard
          title="Completed"
          value={loading ? "—" : completed.length}
          icon={CheckCircle2}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
          change="Certificates earned"
        />
        <StatCard
          title="Total Enrolled"
          value={loading ? "—" : enrollments.length}
          icon={TrendingUp}
          color="text-violet-600"
          bgColor="bg-violet-50"
        />
      </div>

      {/* Continue Learning */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900">Continue Learning</h3>
          <Link href="/my-courses">
            <Button variant="ghost" size="sm" className="text-sky-600 gap-1 hover:text-sky-700 hover:bg-sky-50">
              See all <ArrowRight size={14} />
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : active.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200 shadow-none">
            <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
              <BookOpen size={36} className="text-slate-300" />
              <p className="text-slate-500 text-sm">No active courses yet.</p>
              <Link href="/courses">
                <Button size="sm" className="bg-sky-500 hover:bg-sky-600 text-white mt-1">
                  Browse Courses
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {active.slice(0, 3).map((enrollment) => {
              // Mock progress for demonstration (real progress tracking is Phase 3B)
              const mockProgress = Math.floor(Math.random() * 60) + 20;
              return (
                <Card key={enrollment.id} className="border-0 shadow-sm hover:shadow-md transition-all duration-200 group">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Thumbnail */}
                      <div className="h-14 w-20 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center shrink-0 overflow-hidden">
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
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {enrollment.course.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          by {enrollment.course.teacher.fullName}
                        </p>
                        <div className="mt-2 flex items-center gap-3">
                          <Progress value={mockProgress} className="h-1.5 flex-1" />
                          <span className="text-xs font-medium text-slate-600 shrink-0">
                            {mockProgress}%
                          </span>
                        </div>
                      </div>
                      {/* CTA */}
                      <Link href={`/courses/${enrollment.course.id}`}>
                        <Button
                          size="sm"
                          className="shrink-0 bg-sky-500 hover:bg-sky-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Continue
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Discover more */}
      <Card className="border-0 bg-slate-900 shadow-lg">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold">Discover New Courses</p>
            <p className="text-slate-400 text-sm mt-0.5">Expand your knowledge today</p>
          </div>
          <Link href="/courses">
            <Button className="bg-sky-500 hover:bg-sky-600 text-white gap-1.5 shrink-0">
              <BookOpen size={15} />
              Browse
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
    </div>
  );
}

// ─── Teacher Dashboard ────────────────────────────────────────────────────────

function TeacherDashboard({ fullName }: { fullName: string }) {
  const api = useApi();
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ items: CourseItem[] }>("/api/courses").then((res) => {
      if (res.success && res.data) setCourses(res.data.items);
      setLoading(false);
    }).catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const published = courses.filter((c) => c.isPublished);
  const totalStudents = courses.reduce((acc, c) => acc + c._count.enrollments, 0);

  return (
    <div className="mx-auto px-6 md:px-12 lg:px-24 max-w-7xl py-10">
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Hello, {fullName.split(" ")[0]} 👨‍🏫
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Manage your courses and track student progress.
          </p>
        </div>
        <Link href="/courses/new">
          <Button className="bg-sky-500 hover:bg-sky-600 text-white gap-2 shadow-sm">
            <PlusCircle size={16} />
            Create Course
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Active Courses"
          value={loading ? "—" : published.length}
          icon={Layers}
          color="text-sky-600"
          bgColor="bg-sky-50"
          change="Published & live"
        />
        <StatCard
          title="Total Students"
          value={loading ? "—" : totalStudents}
          icon={Users}
          color="text-violet-600"
          bgColor="bg-violet-50"
          change="Across all courses"
        />
        <StatCard
          title="Draft Courses"
          value={loading ? "—" : courses.length - published.length}
          icon={BookOpen}
          color="text-amber-600"
          bgColor="bg-amber-50"
        />
      </div>

      {/* My courses list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900">My Courses</h3>
          <Link href="/courses/manage">
            <Button variant="ghost" size="sm" className="text-sky-600 gap-1 hover:text-sky-700 hover:bg-sky-50">
              Manage all <ArrowRight size={14} />
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200 shadow-none">
            <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
              <Layers size={36} className="text-slate-300" />
              <p className="text-slate-500 text-sm">No courses yet. Create your first!</p>
              <Link href="/courses/new">
                <Button size="sm" className="bg-sky-500 hover:bg-sky-600 text-white mt-1 gap-1.5">
                  <PlusCircle size={14} />
                  New Course
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {courses.slice(0, 4).map((course) => (
              <Card key={course.id} className="border-0 shadow-sm hover:shadow-md transition-all duration-200 group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {course.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge
                          variant={course.isPublished ? "default" : "secondary"}
                          className={
                            course.isPublished
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[11px]"
                              : "text-[11px]"
                          }
                        >
                          {course.isPublished ? "Published" : "Draft"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {course._count.enrollments} students
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers size={12} />
                      {course._count.modules} modules
                    </span>
                  </div>
                  <Link href={`/courses/${course.id}`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3 w-full text-sky-600 hover:text-sky-700 hover:bg-sky-50 gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Manage <ArrowRight size={13} />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

function AdminDashboard({ fullName }: { fullName: string }) {
  const api = useApi();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ items: UserItem[]; total: number }>("/api/users?limit=5"),
      api.get<{ items: CourseItem[]; total: number }>("/api/courses?limit=5"),
    ]).then(([uRes, cRes]) => {
      if (uRes.success && uRes.data) setUsers(uRes.data.items);
      if (cRes.success && cRes.data) setCourses(cRes.data.items);
      setLoading(false);
    }).catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roleColors: Record<string, string> = {
    ADMIN: "bg-violet-100 text-violet-700",
    TEACHER: "bg-amber-100 text-amber-700",
    STUDENT: "bg-sky-100 text-sky-700",
  };

  return (
    <div className="mx-auto px-6 md:px-12 lg:px-24 max-w-7xl py-10">
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">Admin Control Panel</p>
            <h2 className="mt-1 text-2xl font-bold">{fullName}</h2>
            <p className="mt-1 text-slate-400 text-sm">Platform overview & management</p>
          </div>
          <div className="hidden sm:flex h-16 w-16 rounded-2xl bg-white/10 items-center justify-center">
            <BarChart3 size={30} className="text-white" />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={loading ? "—" : users.length}
          icon={Users}
          color="text-violet-600"
          bgColor="bg-violet-50"
          change="Platform-wide"
        />
        <StatCard
          title="Total Courses"
          value={loading ? "—" : courses.length}
          icon={BookOpen}
          color="text-sky-600"
          bgColor="bg-sky-50"
        />
        <StatCard
          title="Published"
          value={loading ? "—" : courses.filter((c) => c.isPublished).length}
          icon={CheckCircle2}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
          change="Live courses"
        />
        <StatCard
          title="Enrollments"
          value={loading ? "—" : courses.reduce((a, c) => a + c._count.enrollments, 0)}
          icon={GraduationCap}
          color="text-amber-600"
          bgColor="bg-amber-50"
        />
      </div>

      {/* Two columns: users + courses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent registrations */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Users size={16} className="text-violet-500" />
              Recent Registrations
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 px-6 pb-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 rounded-lg bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50 transition-colors"
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
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    </div>
                    <Badge
                      className={`text-[10px] shrink-0 ${roleColors[user.role] ?? ""}`}
                      variant="secondary"
                    >
                      {user.role}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            <div className="px-6 py-3 border-t border-slate-100">
              <Link href="/admin/users">
                <Button variant="ghost" size="sm" className="text-slate-500 gap-1 hover:text-slate-700 w-full justify-center text-xs">
                  View all users <ArrowRight size={12} />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Recent courses */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <BookOpen size={16} className="text-sky-500" />
              Recent Courses
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 px-6 pb-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 rounded-lg bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {courses.map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="h-8 w-8 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
                      <BookOpen size={14} className="text-sky-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {course.title}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock size={10} />
                        {course._count.enrollments} enrolled
                      </p>
                    </div>
                    <Badge
                      variant={course.isPublished ? "default" : "secondary"}
                      className={
                        course.isPublished
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px]"
                          : "text-[10px]"
                      }
                    >
                      {course.isPublished ? "Live" : "Draft"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            <div className="px-6 py-3 border-t border-slate-100">
              <Link href="/admin/courses">
                <Button variant="ghost" size="sm" className="text-slate-500 gap-1 hover:text-slate-700 w-full justify-center text-xs">
                  View all courses <ArrowRight size={12} />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="mx-auto px-6 md:px-12 lg:px-24 max-w-7xl py-10">
        <div className="space-y-6 max-w-5xl">
          <div className="h-32 rounded-2xl bg-slate-100 animate-pulse" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  switch (user.role) {
    case "TEACHER":
      return <TeacherDashboard fullName={user.fullName} />;
    case "ADMIN":
      return <AdminDashboard fullName={user.fullName} />;
    default:
      return <StudentDashboard fullName={user.fullName} />;
  }
}
