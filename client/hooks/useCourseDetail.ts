"use client";

/**
 * hooks/useCourseDetail.ts
 *
 * Fetches a single course with its full nested structure:
 *   Course → Modules (sorted) → Lessons (sorted) + Teacher info
 *
 * Also fetches the current user's enrollment status for this course
 * (student-only — other roles skip that call).
 */

import { useState, useEffect, useCallback } from "react";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";

// ─── Types (mirrors Prisma include shape from getCourseById) ──────────────────

export interface LessonSummary {
  id: string;
  title: string;
  orderIndex: number;
  materials: MaterialSummary[];
}

export interface MaterialSummary {
  id: string;
  title: string;
  fileUrl: string;
  geminiFileUri: string | null;
}

export interface ModuleSummary {
  id: string;
  title: string;
  description: string | null;
  orderIndex: number;
  lessons: LessonSummary[];
}

export interface CourseDetail {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  isPublished: boolean;
  isPrivate: boolean;
  aiEnabled: boolean;
  teacherId: string;
  teacher: { id: string; fullName: string; avatarUrl: string | null };
  modules: ModuleSummary[];
  _count: { enrollments: number; modules: number };
  createdAt: string;
}

export type EnrollmentStatus = "ACTIVE" | "COMPLETED" | "DROPPED" | null;

interface UseCourseDetailReturn {
  course: CourseDetail | null;
  enrollmentStatus: EnrollmentStatus;
  isLoading: boolean;
  error: string | null;
  refetchCourse: () => Promise<void>;
  refetchEnrollment: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCourseDetail(courseId: string): UseCourseDetailReturn {
  const api = useApi();
  const { user } = useAuth();

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [enrollmentStatus, setEnrollmentStatus] = useState<EnrollmentStatus>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourse = useCallback(async () => {
    if (!courseId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<CourseDetail>(`/api/courses/${courseId}`);
      if (res.success && res.data) {
        setCourse(res.data);
      } else {
        setError(res.error ?? "Course not found.");
      }
    } catch {
      setError("Failed to load course.");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // Fetch the course once
  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  // Check enrollment status for students
  const fetchEnrollment = useCallback(async () => {
    if (!user || user.role !== "STUDENT") return;
    const res = await api.get<Array<{ status: string; course: { id: string } }>>(
      "/api/enrollments/my"
    );
    if (res.success && res.data) {
      const match = res.data.find((e) => e.course.id === courseId);
      setEnrollmentStatus((match?.status as EnrollmentStatus) ?? null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, user?.id]);

  useEffect(() => { fetchEnrollment(); }, [fetchEnrollment]);

  return {
    course,
    enrollmentStatus,
    isLoading,
    error,
    refetchCourse: fetchCourse,
    refetchEnrollment: fetchEnrollment,
  };
}
