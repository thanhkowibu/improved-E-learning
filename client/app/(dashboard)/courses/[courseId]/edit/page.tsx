"use client";

/**
 * app/(dashboard)/courses/[courseId]/edit/page.tsx
 *
 * Edit Course page — fetches existing course, pre-populates CourseForm.
 * Submits to PATCH /api/courses/:courseId.
 *
 * Key fixes:
 *  - ALL hooks are declared at the top, before any conditional returns
 *    (Rules of Hooks compliance).
 *  - After a successful PATCH, calls formRef.current.reset(savedData) —
 *    the react-hook-form canonical way to show fresh values without a page
 *    reload, instead of the broken useMemo/defaultValues hack.
 *  - Role guard (STUDENT → redirect) placed after all hook declarations.
 *
 * Access: Course owner (TEACHER) or ADMIN only.
 */

import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Settings,
  Trash2,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { useCourseDetail } from "@/hooks/useCourseDetail";
import CourseForm, {
  type CourseFormValues,
  type CourseFormHandle,
} from "@/components/CourseForm";
import CurriculumEditor from "@/components/curriculum/CurriculumEditor";
import { MaterialsTable } from "@/components/materials/MaterialsTable";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function EditSkeleton() {
  return (
    <div className="max-w-2xl space-y-6">
      <Skeleton className="h-8 w-1/2 rounded-xl" />
      <div className="space-y-4">
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditCoursePage() {
  // ── ALL hooks declared at the very top (Rules of Hooks) ──────────────────
  const params = useParams();
  const courseId = params?.courseId as string;
  const router = useRouter();
  const api = useApi();
  const { user } = useAuth();
  const { course, isLoading, error, refetchCourse } = useCourseDetail(courseId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Ref to access CourseForm's imperative reset() handle
  const formRef = useRef<CourseFormHandle>(null);
  const lessonOptions = useMemo(
    () =>
      course?.modules.flatMap((module) =>
        module.lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          moduleTitle: module.title,
        })),
      ) ?? [],
    [course],
  );

  useEffect(() => {
    function handleCourseDataChanged() {
      refetchCourse();
      router.refresh();
    }

    window.addEventListener(
      "course-materials-changed",
      handleCourseDataChanged,
    );
    window.addEventListener(
      "course-ai-settings-changed",
      handleCourseDataChanged,
    );

    return () => {
      window.removeEventListener(
        "course-materials-changed",
        handleCourseDataChanged,
      );
      window.removeEventListener(
        "course-ai-settings-changed",
        handleCourseDataChanged,
      );
    };
  }, [refetchCourse, router]);

  // ── Role guard — after all hooks ─────────────────────────────────────────
  if (user && user.role === "STUDENT") {
    router.replace("/dashboard");
    return null;
  }

  // ── PATCH handler ─────────────────────────────────────────────────────────
  async function handleSubmit(values: CourseFormValues) {
    setIsSubmitting(true);
    const toastId = toast.loading("Saving changes…");

    const body = {
      title: values.title,
      description: values.description?.trim() || null,
      thumbnailUrl: values.thumbnailUrl?.trim() || null,
      isPublished: values.isPublished,
      aiEnabled: values.aiEnabled,
    };

    const res = await api.patch(`/api/courses/${courseId}`, body);

    if (res.success) {
      toast.success("Course updated successfully.", { id: toastId });
      // Imperatively reset the form to show the just-saved values.
      // This is the react-hook-form canonical approach — avoids the
      // useMemo/defaultValues hack that caused continuous re-renders.
      formRef.current?.reset({
        title: values.title,
        description: values.description ?? "",
        thumbnailUrl: values.thumbnailUrl ?? "",
        isPublished: values.isPublished,
        aiEnabled: values.aiEnabled,
      });
      await refetchCourse();
      router.refresh();
    } else {
      toast.error(res.error ?? "Failed to save changes. Please try again.", {
        id: toastId,
      });
    }
    setIsSubmitting(false);
  }

  // ── DELETE handler ────────────────────────────────────────────────────────
  async function handleDelete() {
    if (
      !confirm(
        `⚠️ Delete "${course?.title}"?\n\nThis will permanently remove the course, all its modules, lessons, and materials. This action cannot be undone.`,
      )
    )
      return;

    setIsDeleting(true);
    const toastId = toast.loading("Deleting course…");
    const res = await api.del(`/api/courses/${courseId}`);

    if (res.success) {
      toast.success("Course deleted.", { id: toastId });
      router.push("/my-courses");
    } else {
      toast.error(res.error ?? "Failed to delete course.", { id: toastId });
      setIsDeleting(false);
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="mx-auto px-6 md:px-12 lg:px-24 max-w-7xl py-10">
        <div className="h-6 w-32 rounded-lg bg-slate-100 animate-pulse mb-8" />
        <EditSkeleton />
      </div>
    );
  }

  // ── Error / 404 ───────────────────────────────────────────────────────────
  if (error || !course) {
    return (
      <div className="mx-auto px-6 md:px-12 lg:px-24 max-w-7xl py-10">
        <p className="text-red-500 text-sm">{error ?? "Course not found."}</p>
        <Link
          href="/my-courses"
          className="text-sky-600 text-sm hover:underline mt-2 inline-block"
        >
          ← Back to My Courses
        </Link>
      </div>
    );
  }

  // Default values passed once into the form on mount
  const defaultValues: Partial<CourseFormValues> = {
    title: course.title,
    description: course.description ?? "",
    thumbnailUrl: course.thumbnailUrl ?? "",
    isPublished: course.isPublished,
    aiEnabled: course.aiEnabled,
  };

  return (
    <div className="mx-auto px-6 md:px-12 lg:px-24 max-w-7xl py-10">
      {/* ── Header ── */}
      <div className="mb-8">
        <Link
          href={`/courses/${courseId}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-4"
        >
          <ArrowLeft size={14} />
          Back to Course
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Settings size={18} className="text-slate-500" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Edit Course
              </h1>
              <p className="text-sm text-slate-500 mt-0.5 max-w-md truncate">
                {course.title}
              </p>
            </div>
          </div>
          <Link
            href={`/courses/${courseId}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-sm text-sky-600 hover:text-sky-700 border border-sky-200 rounded-xl px-3 py-2 hover:bg-sky-50 transition-colors"
          >
            <ExternalLink size={14} />
            Preview
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Main: Course Form ── */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <h2 className="text-base font-semibold text-slate-900 mb-6">
              Course Details
            </h2>
            <CourseForm
              ref={formRef}
              mode="edit"
              defaultValues={defaultValues}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>

        {/* ── Sidebar: Info + Danger Zone ── */}
        <div className="space-y-4">
          {/* Quick info */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              Course Info
            </h3>
            <div className="space-y-2 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>Modules</span>
                <span className="font-medium text-slate-800">
                  {course._count.modules}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Enrollments</span>
                <span className="font-medium text-slate-800">
                  {course._count.enrollments}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Status</span>
                <span
                  className={`font-semibold ${
                    course.isPublished ? "text-emerald-600" : "text-amber-600"
                  }`}
                >
                  {course.isPublished ? "Published" : "Draft"}
                </span>
              </div>
            </div>
          </div>

          {/* Danger zone */}
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={15} className="text-red-500" />
              <h3 className="text-sm font-semibold text-red-700">
                Danger Zone
              </h3>
            </div>
            <Separator className="mb-4" />
            <p className="text-xs text-slate-500 mb-4">
              Permanently delete this course along with all its modules,
              lessons, and uploaded materials. This cannot be undone.
            </p>
            <Button
              id="delete-course-btn"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full rounded-xl gap-2 font-semibold"
            >
              {isDeleting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              Delete Course
            </Button>
          </div>
        </div>
      </div>

      {/* ── Curriculum Editor (full width, below the form/sidebar grid) ── */}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Tabs defaultValue="curriculum" className="space-y-6">
          <TabsList variant="line" className="font-bold">
            <TabsTrigger value="curriculum" className="px-3">
              Curriculum
            </TabsTrigger>
            <TabsTrigger value="materials" className="px-3">
              Materials
            </TabsTrigger>
          </TabsList>
          <TabsContent value="curriculum" className="mt-0">
            <CurriculumEditor courseId={courseId} />
          </TabsContent>
          <TabsContent value="materials" className="mt-0">
            <MaterialsTable courseId={courseId} lessons={lessonOptions} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
