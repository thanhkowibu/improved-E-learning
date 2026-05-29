"use client";

/**
 * app/(dashboard)/courses/new/page.tsx
 *
 * Create Course page — renders CourseForm in "create" mode.
 * Submits to POST /api/courses.
 * On success → redirect to the Edit page so the teacher can add modules.
 *
 * Access: TEACHER / ADMIN only.
 * (Middleware handles server-side guard; component double-checks role.)
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, PlusCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import CourseForm, { type CourseFormValues } from "@/components/CourseForm";

export default function NewCoursePage() {
  const router = useRouter();
  const { user } = useAuth();
  const api = useApi();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Role guard on client (middleware already handles server-side)
  if (user && user.role === "STUDENT") {
    router.replace("/dashboard");
    return null;
  }

  async function handleSubmit(values: CourseFormValues) {
    setIsSubmitting(true);
    const toastId = toast.loading("Creating your course…");

    // Filter out fields that isn't needed for course creation
    const { aiEnabled, isPublished, ...submitData } = values;

    // Map empty thumbnailUrl to null for the API
    const body = {
      ...submitData,
      thumbnailUrl: submitData.thumbnailUrl?.trim() || null,
      description: submitData.description?.trim() || null,
    };

    const res = await api.post<{ id: string }>("/api/courses", body);

    if (res.success && res.data) {
      toast.success("Course created! Now add modules and lessons.", { id: toastId });
      router.push(`/courses/${res.data.id}/edit`);
    } else {
      toast.error(res.error ?? "Failed to create course. Please try again.", { id: toastId });
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto px-6 md:px-12 lg:px-24 max-w-7xl py-10">
      {/* ── Header ── */}
      <div className="mb-8">
        <Link
          href="/my-courses"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-4"
        >
          <ArrowLeft size={14} />
          Back to My Courses
        </Link>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-sky-50 flex items-center justify-center">
            <PlusCircle size={20} className="text-sky-500" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Create New Course
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Fill in the basics — you can add modules and lessons after saving.
            </p>
          </div>
        </div>
      </div>

      {/* ── Form card ── */}
      <div className="max-w-2xl">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <CourseForm
            mode="create"
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        </div>

        {/* Tip */}
        <p className="mt-4 text-xs text-slate-400 text-center">
          You&apos;ll be redirected to the course editor to add modules and lessons after creation.
        </p>
      </div>
    </div>
  );
}
