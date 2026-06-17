"use client";

/**
 * app/(dashboard)/my-courses/page.tsx
 *
 * My Courses — role-aware page.
 *
 * STUDENT  → "My Learning": enrolled active courses, enrolled variant
 * TEACHER  → "My Courses": courses they created, manage variant
 * ADMIN    → "All Courses": platform-wide, manage variant
 *
 * The useMyCourses hook handles the role-branching at the data layer,
 * so this component stays clean and declarative.
 */

import Link from "next/link";
import { PlusCircle, BookMarked, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import CourseCard from "@/components/CourseCard";
import { useMyCourses } from "@/hooks/useMyCourses";
import { useAuth } from "@/hooks/useAuth";

// ─── Page meta (role-aware) ───────────────────────────────────────────────────

function usePageMeta(role?: string) {
  switch (role) {
    case "TEACHER":
      return {
        title: "Khóa học của tôi",
        subtitle: "Quản lý các khóa học bạn đang giảng dạy.",
        showCreate: true,
        emptyMsg: "Bạn chưa tạo khóa học nào.",
      };
    case "ADMIN":
      return {
        title: "Tất cả khóa học",
        subtitle: "Quản lý toàn bộ khóa học trên hệ thống.",
        showCreate: true,
        emptyMsg: "Chưa có khóa học nào trên hệ thống.",
      };
    default:
      return {
        title: "Khóa học của tôi",
        subtitle: "Tiếp tục bài học đang dang dở.",
        showCreate: false,
        emptyMsg: "Bạn chưa đăng ký khóa học nào.",
      };
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MyCourseSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl overflow-hidden border border-slate-200 bg-white"
        >
          <Skeleton className="aspect-video w-full" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-5 w-3/4 rounded-lg" />
            <Skeleton className="h-4 w-1/2 rounded-lg" />
            <Skeleton className="h-2 w-full rounded-full mt-2" />
            <Skeleton className="h-10 w-full rounded-xl mt-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyCoursesPage() {
  const { user } = useAuth();
  const { courses, variant, isLoading, error, refetch } = useMyCourses();
  const meta = usePageMeta(user?.role);

  return (
    <div className="container mx-auto px-6 md:px-24 py-8 max-w-7xl">
      {/* ── Header ── */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            {meta.title}
          </h1>
          <p className="mt-1 text-slate-500 text-base">{meta.subtitle}</p>
        </div>
        {meta.showCreate && (
          <Link href="/courses/new">
            <Button
              id="my-courses-create-btn"
              className="bg-sky-500 hover:bg-sky-600 text-white rounded-xl gap-2 font-semibold shadow-sm"
            >
              <PlusCircle size={16} />
              Tạo khóa học
            </Button>
          </Link>
        )}
      </div>

      {/* ── Count ── */}
      {!isLoading && !error && courses.length > 0 && (
        <p className="mb-5 text-sm text-slate-500">{courses.length} khóa học</p>
      )}

      {/* ── Loading ── */}
      {isLoading && <MyCourseSkeleton />}

      {/* ── Error ── */}
      {!isLoading && error && (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center">
            <AlertCircle size={28} className="text-red-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Đã xảy ra lỗi</p>
            <p className="text-sm text-slate-500 mt-1">{error}</p>
          </div>
          <Button
            variant="outline"
            onClick={refetch}
            className="rounded-xl border-sky-300 text-sky-600 hover:bg-sky-50"
          >
            Thử lại
          </Button>
        </div>
      )}

      {/* ── Empty ── */}
      {!isLoading && !error && courses.length === 0 && (
        <div className="flex flex-col items-center gap-5 py-24 text-center">
          <div className="h-16 w-16 rounded-2xl bg-sky-50 flex items-center justify-center">
            <BookMarked size={32} className="text-sky-300" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">{meta.emptyMsg}</p>
            {user?.role === "STUDENT" && (
              <p className="text-sm text-slate-500 mt-1">
                Duyệt danh mục và đăng ký một khóa học để bắt đầu.
              </p>
            )}
          </div>
          {user?.role === "STUDENT" ? (
            <Link href="/courses">
              <Button className="bg-sky-500 hover:bg-sky-600 text-white rounded-xl">
                Duyệt khóa học
              </Button>
            </Link>
          ) : (
            <Link href="/courses/new">
              <Button className="bg-sky-500 hover:bg-sky-600 text-white rounded-xl gap-2">
                <PlusCircle size={15} />
                Tạo khóa học đầu tiên
              </Button>
            </Link>
          )}
        </div>
      )}

      {/* ── Grid ── */}
      {!isLoading && !error && courses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} variant={variant} />
          ))}
        </div>
      )}
    </div>
  );
}
