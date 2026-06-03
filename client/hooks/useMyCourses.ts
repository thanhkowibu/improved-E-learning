"use client";

/**
 * hooks/useMyCourses.ts
 *
 * Role-aware data hook for the "My Courses" page.
 *
 * STUDENT  → GET /api/enrollments/my  (enrolled courses with status)
 * TEACHER  → GET /api/courses          (their own courses — server filters by role)
 * ADMIN    → GET /api/courses          (all courses)
 *
 * Returns CourseCardData shaped for the `manage` or `enrolled` card variant.
 */

import { useState, useEffect, useCallback } from "react";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import type { CourseCardData, CourseCardVariant } from "@/components/CourseCard";

interface EnrollmentItem {
  id: string;
  status: "ACTIVE" | "COMPLETED" | "DROPPED";
  progress: number;
  nextLessonId: string | null;
  course: {
    id: string;
    title: string;
    description?: string | null;
    thumbnailUrl?: string | null;
    teacher: { id: string; fullName: string };
    _count: { modules: number; enrollments: number };
  };
}

interface ApiCourse {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  isPublished: boolean;
  teacher: { id: string; fullName: string };
  _count: { modules: number; enrollments: number };
}

interface UseMyCoursesReturn {
  courses: CourseCardData[];
  variant: CourseCardVariant;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useMyCourses(): UseMyCoursesReturn {
  const api = useApi();
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);

    try {
      if (user.role === "STUDENT") {
        const res = await api.get<EnrollmentItem[]>("/api/enrollments/my?status=ACTIVE");
        if (res.success && res.data) {
          setCourses(
            res.data.map((e) => ({
              id: e.course.id,
              title: e.course.title,
              description: e.course.description,
              thumbnailUrl: e.course.thumbnailUrl,
              teacher: e.course.teacher,
              _count: e.course._count,
              enrollmentStatus: e.status,
              progress: e.progress,
              nextLessonId: e.nextLessonId,
            }))
          );
        } else {
          setError(res.error ?? "Failed to load your courses.");
        }
      } else {
        // TEACHER or ADMIN
        const res = await api.get<{ items: ApiCourse[] }>("/api/courses?limit=100");
        if (res.success && res.data) {
          setCourses(
            res.data.items.map((c) => ({
              id: c.id,
              title: c.title,
              description: c.description,
              thumbnailUrl: c.thumbnailUrl,
              isPublished: c.isPublished,
              teacher: c.teacher,
              _count: c._count,
            }))
          );
        } else {
          setError(res.error ?? "Failed to load your courses.");
        }
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const variant: CourseCardVariant =
    user?.role === "STUDENT" ? "enrolled" : "manage";

  return { courses, variant, isLoading, error, refetch: fetch_ };
}
