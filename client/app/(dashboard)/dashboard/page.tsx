"use client";

/**
 * app/(dashboard)/dashboard/page.tsx  →  /dashboard
 *
 * Role-aware dashboard hub.
 *
 * Renders one of three dashboards based on the authenticated user's role:
 *   STUDENT  → <StudentDashboard />  — real progress, continue-learning list
 *   TEACHER  → <TeacherDashboard />  — my courses + student counts
 *   ADMIN    → <AdminDashboard />    — platform-wide stats + user/course feeds
 *
 * Auth is handled by DashboardLayout; this page can assume `user` is non-null
 * once loading is complete.
 */

import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import StudentDashboard from "@/components/dashboard/StudentDashboard";
import TeacherDashboard from "@/components/dashboard/TeacherDashboard";
import AdminDashboard from "@/components/dashboard/AdminDashboard";

// ─── Full-page skeleton (matches the rough shape of any dashboard) ────────────

function PageSkeleton() {
  return (
    <div className="mx-auto px-6 md:px-12 lg:px-24 max-w-7xl py-10">
      <div className="space-y-8 max-w-5xl">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <PageSkeleton />;
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
