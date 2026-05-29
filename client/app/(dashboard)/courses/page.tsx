"use client";

/**
 * app/(dashboard)/courses/page.tsx
 *
 * Course Catalog — public grid of published courses.
 * Accessible to all roles (guest redirected to login by middleware,
 * authenticated users see the full catalog).
 *
 * Features:
 *   - Live search (client-side filter on title)
 *   - 3-column responsive grid (1 → 2 → 3 cols)
 *   - Shadcn Skeleton loading state
 *   - Empty / error states
 */

import { useState } from "react";
import { Search, BookOpen, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import CourseCard from "@/components/CourseCard";
import { useCourses } from "@/hooks/useCourses";

// ─── Skeleton grid ────────────────────────────────────────────────────────────

function CourseGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CourseCatalogPage() {
  const [search, setSearch] = useState("");
  const { courses, isLoading, error, refetch } = useCourses({ search });

  return (
    <div className="container mx-auto px-6 md:px-24 py-8 max-w-7xl">
      {/* ── Page header ── */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Course Catalog
        </h1>
        <p className="mt-1 text-slate-500 text-base">
          Explore all available courses and start learning today.
        </p>
      </div>

      {/* ── Search bar ── */}
      <div className="mb-8 flex gap-3 max-w-xl">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <Input
            id="catalog-search"
            type="text"
            placeholder="Search courses by title…"
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
            Clear
          </Button>
        )}
      </div>

      {/* ── Results count ── */}
      {!isLoading && !error && (
        <p className="mb-5 text-sm text-slate-500">
          {courses.length === 0
            ? "No courses found."
            : `${courses.length} course${courses.length !== 1 ? "s" : ""} found`}
          {search && ` for "${search}"`}
        </p>
      )}

      {/* ── Loading ── */}
      {isLoading && <CourseGridSkeleton />}

      {/* ── Error ── */}
      {!isLoading && error && (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center">
            <AlertCircle size={28} className="text-red-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Something went wrong</p>
            <p className="text-sm text-slate-500 mt-1">{error}</p>
          </div>
          <Button
            variant="outline"
            onClick={refetch}
            className="rounded-xl border-sky-300 text-sky-600 hover:bg-sky-50"
          >
            Try again
          </Button>
        </div>
      )}

      {/* ── Empty ── */}
      {!isLoading && !error && courses.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center">
            <BookOpen size={32} className="text-slate-300" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">No courses found</p>
            <p className="text-sm text-slate-500 mt-1">
              {search
                ? `No courses match "${search}". Try a different keyword.`
                : "No published courses are available yet."}
            </p>
          </div>
          {search && (
            <Button
              variant="ghost"
              onClick={() => setSearch("")}
              className="text-sky-600 hover:text-sky-700"
            >
              Clear search
            </Button>
          )}
        </div>
      )}

      {/* ── Course grid ── */}
      {!isLoading && !error && courses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} variant="catalog" />
          ))}
        </div>
      )}
    </div>
  );
}