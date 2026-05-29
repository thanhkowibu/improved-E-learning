"use client";

/**
 * hooks/useCourses.ts
 *
 * Data-fetching hook for the public course catalog.
 * Reads from GET /api/courses (returns published courses by default).
 *
 * Handles: loading skeleton, error state, client-side search filtering,
 * and re-fetch on demand.
 */

import { useState, useEffect, useCallback } from "react";
import { useApi } from "@/hooks/useApi";
import type { CourseCardData } from "@/components/CourseCard";

interface ApiCourse {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  isPublished: boolean;
  teacher: { id: string; fullName: string };
  _count: { modules: number; enrollments: number };
}

interface UseCourseOptions {
  /** Only include courses whose title matches this string (client-side filter) */
  search?: string;
  /** Passed as ?limit= query param */
  limit?: number;
}

interface UseCoursesReturn {
  courses: CourseCardData[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCourses({ search = "", limit = 50 }: UseCourseOptions = {}): UseCoursesReturn {
  const api = useApi();
  const [raw, setRaw] = useState<ApiCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const res = await api.get<{ items: ApiCourse[] }>(`/api/courses?limit=${limit}`);
    if (res.success && res.data) {
      setRaw(res.data.items);
    } else {
      setError(res.error ?? "Failed to load courses.");
    }
    setIsLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const courses: CourseCardData[] = raw
    .filter((c) =>
      search.trim() === "" ||
      c.title.toLowerCase().includes(search.trim().toLowerCase())
    )
    .map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      thumbnailUrl: c.thumbnailUrl,
      isPublished: c.isPublished,
      teacher: c.teacher,
      _count: c._count,
    }));

  return { courses, isLoading, error, refetch: fetch_ };
}
