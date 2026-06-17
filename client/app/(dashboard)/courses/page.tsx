"use client";

/**
 * app/(dashboard)/courses/page.tsx
 *
 * Course Catalog - public grid of published courses.
 */

import { useState } from "react";
import { Search, BookOpen, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import CourseCard from "@/components/CourseCard";
import { useCourses } from "@/hooks/useCourses";

function CourseGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
          <Skeleton className="aspect-video w-full" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-5 w-3/4 rounded-lg" />
            <Skeleton className="h-4 w-1/2 rounded-lg" />
            <Skeleton className="h-4 w-1/3 rounded-lg" />
            <Skeleton className="h-10 w-full rounded-xl mt-4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CourseCatalogPage() {
  const [search, setSearch] = useState("");
  const { courses, isLoading, error, refetch } = useCourses({ search });

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 md:px-12 lg:px-24">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Danh mục khóa học
        </h1>
        <p className="mt-1 text-slate-500 text-base">
          Khám phá các khóa học hiện có và bắt đầu học ngay hôm nay.
        </p>
      </div>

      <div className="mb-8 flex max-w-xl flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <Input
            id="catalog-search"
            type="text"
            placeholder="Tìm khóa học theo tiêu đề..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl border-slate-200 bg-white shadow-sm focus-visible:ring-sky-400 text-sm h-11"
          />
        </div>
        {search && (
          <Button
            variant="ghost"
            onClick={() => setSearch("")}
            className="shrink-0 text-slate-500 hover:text-slate-700"
          >
            Xóa
          </Button>
        )}
      </div>

      {!isLoading && !error && (
        <p className="mb-5 text-sm text-slate-500">
          {courses.length === 0
            ? "Không tìm thấy khóa học."
            : `Tìm thấy ${courses.length} khóa học`}
          {search && ` cho "${search}"`}
        </p>
      )}

      {isLoading && <CourseGridSkeleton />}

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

      {!isLoading && !error && courses.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center">
            <BookOpen size={32} className="text-slate-300" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Không tìm thấy khóa học</p>
            <p className="text-sm text-slate-500 mt-1">
              {search
                ? `Không có khóa học nào khớp với "${search}". Hãy thử từ khóa khác.`
                : "Chưa có khóa học đã xuất bản."}
            </p>
          </div>
          {search && (
            <Button
              variant="ghost"
              onClick={() => setSearch("")}
              className="text-sky-600 hover:text-sky-700"
            >
              Xóa tìm kiếm
            </Button>
          )}
        </div>
      )}

      {!isLoading && !error && courses.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} variant="catalog" />
          ))}
        </div>
      )}
    </div>
  );
}
