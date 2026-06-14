"use client";

/**
 * components/EnrollButton.tsx
 *
 * Enrollment CTA - state-aware button for students on the course detail page.
 */

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Loader2,
  BookOpen,
  LogIn,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import type { EnrollmentStatus } from "@/hooks/useCourseDetail";

interface EnrollButtonProps {
  courseId: string;
  enrollmentStatus: EnrollmentStatus;
  onStatusChange: () => void;
}

export default function EnrollButton({
  courseId,
  enrollmentStatus,
  onStatusChange,
}: EnrollButtonProps) {
  const api = useApi();
  const { user } = useAuth();
  const [pending, setPending] = useState(false);
  const [isUnenrollDialogOpen, setIsUnenrollDialogOpen] = useState(false);

  if (!user) {
    return (
      <Link href={`/login?next=/courses/${courseId}`}>
        <Button className="bg-sky-500 hover:bg-sky-600 text-white rounded-xl px-8 py-3 text-base font-semibold gap-2 shadow-md">
          <LogIn size={18} />
          Đăng nhập để đăng ký khóa học
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
          Chỉnh sửa khóa học
        </Button>
      </Link>
    );
  }

  async function handleEnroll() {
    setPending(true);
    const toastId = toast.loading("Đang đăng ký khóa học...");
    const res = await api.post(`/api/courses/${courseId}/enroll`);
    setPending(false);

    if (res.success) {
      toast.success("Đăng ký thành công! Bạn có thể bắt đầu học ngay.", {
        id: toastId,
      });
      onStatusChange();
    } else {
      toast.error(res.error ?? "Đăng ký thất bại. Vui lòng thử lại.", {
        id: toastId,
      });
    }
  }

  async function handleUnenroll() {
    setPending(true);
    const toastId = toast.loading("Đang hủy đăng ký khóa học...");
    const res = await api.del(`/api/courses/${courseId}/enroll`);
    setPending(false);

    if (res.success) {
      toast.success("Bạn đã hủy đăng ký khóa học.", { id: toastId });
      setIsUnenrollDialogOpen(false);
      onStatusChange();
    } else {
      toast.error(res.error ?? "Không thể hủy đăng ký. Vui lòng thử lại.", {
        id: toastId,
      });
    }
  }

  if (enrollmentStatus === "ACTIVE") {
    return (
      <>
        <div className="flex items-center gap-3 flex-wrap">
          <Link href={`/courses/${courseId}/learn`}>
            <Button className="bg-sky-500 hover:bg-sky-600 text-white rounded-xl px-8 py-3 text-base font-semibold gap-2 shadow-md">
              <BookOpen size={18} />
              Tiếp tục học
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsUnenrollDialogOpen(true)}
            disabled={pending}
            className="text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl text-sm"
          >
            {pending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              "Hủy đăng ký"
            )}
          </Button>
        </div>

        <AlertDialog
          open={isUnenrollDialogOpen}
          onOpenChange={(open) => {
            if (!pending) setIsUnenrollDialogOpen(open);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hủy đăng ký khóa học?</AlertDialogTitle>
              <AlertDialogDescription>
                Bạn sẽ rời khỏi khóa học này. Tiến độ học tập có thể không còn
                được hiển thị trong danh sách lớp học của bạn.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Hủy</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={pending}
                onClick={(event) => {
                  event.preventDefault();
                  void handleUnenroll();
                }}
                className="gap-2"
              >
                {pending && <Loader2 size={14} className="animate-spin" />}
                Hủy đăng ký
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
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
          Hoàn thành
        </Button>
        <Link href={`/courses/${courseId}/learn`}>
          <Button
            variant="outline"
            className="rounded-xl px-6 font-semibold border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          >
            Xem lại khóa học
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
        Đăng ký lại
      </Button>
    );
  }

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
      Đăng ký học miễn phí
    </Button>
  );
}
