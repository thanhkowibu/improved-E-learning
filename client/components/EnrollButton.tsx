"use client";

/**
 * components/EnrollButton.tsx
 *
 * Enrollment CTA — state-aware button for students on the course detail page.
 *
 * States:
 *   null (not enrolled)   → sky "Enroll Now" button
 *   "ACTIVE"              → outline "Unenroll" + solid "Go to Course"
 *   "COMPLETED"           → disabled "Completed ✓" + outline "Review"
 *   "DROPPED"             → sky "Re-enroll" button
 *
 * Non-student roles (TEACHER / ADMIN) see "Edit Course" instead.
 * Uses sonner `toast` for success / error feedback.
 */

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, BookOpen, LogIn, RotateCcw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import type { EnrollmentStatus } from "@/hooks/useCourseDetail";

interface EnrollButtonProps {
  courseId: string;
  enrollmentStatus: EnrollmentStatus;
  onStatusChange: () => void; // triggers refetchEnrollment in parent
}

export default function EnrollButton({
  courseId,
  enrollmentStatus,
  onStatusChange,
}: EnrollButtonProps) {
  const api = useApi();
  const { user } = useAuth();
  const [pending, setPending] = useState(false);

  // ── Non-student roles ──────────────────────────────────────────────────────
  if (!user) {
    return (
      <Link href={`/login?next=/courses/${courseId}`}>
        <Button className="bg-sky-500 hover:bg-sky-600 text-white rounded-xl px-8 py-3 text-base font-semibold gap-2 shadow-md">
          <LogIn size={18} />
          Log in to Enroll
        </Button>
      </Link>
    );
  }

  if (user.role === "TEACHER" || user.role === "ADMIN") {
    return (
      <Link href={`/courses/${courseId}/edit`}>
        <Button
          variant="outline"
          className="rounded-xl px-6 py-3 font-semibold border-sky-300 text-sky-700 hover:bg-sky-50"
        >
          Edit Course
        </Button>
      </Link>
    );
  }

  // ── Enroll action ──────────────────────────────────────────────────────────
  async function handleEnroll() {
    setPending(true);
    const toastId = toast.loading("Enrolling in course…");
    const res = await api.post(`/api/courses/${courseId}/enroll`);
    setPending(false);
    if (res.success) {
      toast.success("You're enrolled! Start learning now.", { id: toastId });
      onStatusChange();
    } else {
      toast.error(res.error ?? "Enrollment failed. Please try again.", { id: toastId });
    }
  }

  // ── Unenroll action ────────────────────────────────────────────────────────
  async function handleUnenroll() {
    if (!confirm("Are you sure you want to drop this course?")) return;
    setPending(true);
    const toastId = toast.loading("Dropping course…");
    const res = await api.del(`/api/courses/${courseId}/enroll`);
    setPending(false);
    if (res.success) {
      toast.success("You have dropped this course.", { id: toastId });
      onStatusChange();
    } else {
      toast.error(res.error ?? "Failed to drop course. Please try again.", { id: toastId });
    }
  }

  // ── Render by enrollment status ────────────────────────────────────────────

  if (enrollmentStatus === "ACTIVE") {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <Link href={`/courses/${courseId}/learn`}>
          <Button className="bg-sky-500 hover:bg-sky-600 text-white rounded-xl px-8 py-3 text-base font-semibold gap-2 shadow-md">
            <BookOpen size={18} />
            Go to Course
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleUnenroll}
          disabled={pending}
          className="text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl text-sm"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : "Unenroll"}
        </Button>
      </div>
    );
  }

  if (enrollmentStatus === "COMPLETED") {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          disabled
          className="bg-emerald-500 text-white rounded-xl px-8 py-3 text-base font-semibold gap-2 cursor-default"
        >
          <CheckCircle2 size={18} />
          Completed
        </Button>
        <Link href={`/courses/${courseId}/learn`}>
          <Button
            variant="outline"
            className="rounded-xl px-6 font-semibold border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          >
            Review Course
          </Button>
        </Link>
      </div>
    );
  }

  if (enrollmentStatus === "DROPPED") {
    return (
      <Button
        onClick={handleEnroll}
        disabled={pending}
        className="bg-sky-500 hover:bg-sky-600 text-white rounded-xl px-8 py-3 text-base font-semibold gap-2 shadow-md"
      >
        {pending ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <RotateCcw size={18} />
        )}
        Re-enroll
      </Button>
    );
  }

  // null — not enrolled
  return (
    <Button
      id="enroll-btn"
      onClick={handleEnroll}
      disabled={pending}
      className="bg-sky-500 hover:bg-sky-600 text-white rounded-xl px-8 py-3 text-base font-semibold gap-2 shadow-md"
    >
      {pending ? (
        <Loader2 size={18} className="animate-spin" />
      ) : (
        <LogIn size={18} />
      )}
      Enroll Now — It&apos;s Free
    </Button>
  );
}
