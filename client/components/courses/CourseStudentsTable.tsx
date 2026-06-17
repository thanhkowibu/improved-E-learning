"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpDown, UserRound, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/useApi";

interface CourseStudentsTableProps {
  courseId: string;
}

interface CourseStudentRow {
  id: string;
  studentId: string;
  enrolledAt: string;
  progressPercentage: number;
  student: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
  };
}

interface CourseStudentsResponse {
  items: CourseStudentRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

type SortColumn = "enrolledAt" | "progressPercentage";
type SortDirection = "asc" | "desc";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function StudentsTableSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-5 flex-1 rounded-lg" />
            <Skeleton className="h-5 w-48 rounded-lg" />
            <Skeleton className="h-5 w-28 rounded-lg" />
            <Skeleton className="h-5 w-36 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CourseStudentsTable({ courseId }: CourseStudentsTableProps) {
  const api = useApi();
  const [students, setStudents] = useState<CourseStudentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>("enrolledAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      const left =
        sortColumn === "enrolledAt"
          ? new Date(a.enrolledAt).getTime()
          : a.progressPercentage;
      const right =
        sortColumn === "enrolledAt"
          ? new Date(b.enrolledAt).getTime()
          : b.progressPercentage;

      return sortDirection === "asc" ? left - right : right - left;
    });
  }, [students, sortColumn, sortDirection]);

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortColumn(column);
    setSortDirection("desc");
  }

  const loadStudents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await api.get<CourseStudentsResponse>(
        `/api/courses/${courseId}/students?limit=100`,
      );

      if (res.success && res.data) {
        setStudents(res.data.items);
        setTotal(res.data.total);
      } else {
        setError(res.error ?? res.message ?? "Không thể tải danh sách sinh viên.");
      }
    } catch {
      setError("Đã xảy ra lỗi khi tải danh sách sinh viên.");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  if (isLoading) {
    return <StudentsTableSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white py-14 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-red-50">
          <AlertCircle size={28} className="text-red-400" />
        </div>
        <div>
          <p className="font-semibold text-slate-800">Không thể tải sinh viên</p>
          <p className="mt-1 text-sm text-slate-500">{error}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl border-sky-300 text-sky-600 hover:bg-sky-50"
          onClick={() => void loadStudents()}
        >
          Thử lại
        </Button>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-sky-50">
          <Users size={28} className="text-sky-300" />
        </div>
        <div>
          <p className="font-semibold text-slate-800">Chưa có sinh viên nào</p>
          <p className="mt-1 text-sm text-slate-500">
            Khi sinh viên đăng ký khóa học, họ sẽ xuất hiện tại đây.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Sinh viên</h2>
        <p className="mt-1 text-sm text-slate-500">
          {total} sinh viên đang được theo dõi tiến độ trong khóa học này.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4 py-3">Sinh viên</TableHead>
              <TableHead className="px-4 py-3">Email</TableHead>
              <TableHead className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort("enrolledAt")}
                  className="inline-flex items-center gap-1.5 font-semibold text-slate-700 hover:text-sky-600"
                >
                  Ngày đăng ký
                  <ArrowUpDown size={14} />
                </button>
              </TableHead>
              <TableHead className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort("progressPercentage")}
                  className="inline-flex items-center gap-1.5 font-semibold text-slate-700 hover:text-sky-600"
                >
                  Tiến độ
                  <ArrowUpDown size={14} />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedStudents.map((enrollment) => {
              const progress = Math.max(
                0,
                Math.min(100, enrollment.progressPercentage),
              );

              return (
                <TableRow key={enrollment.id}>
                  <TableCell className="px-4 py-3">
                    <Link
                      href={`/profile/${enrollment.student.id}`}
                      className="inline-flex min-w-0 items-center gap-3 hover:underline"
                    >
                      <Avatar className="size-10">
                        <AvatarImage
                          src={enrollment.student.avatarUrl ?? undefined}
                        />
                        <AvatarFallback className="bg-sky-100 font-bold text-sky-700">
                          {getInitials(enrollment.student.fullName) || (
                            <UserRound size={16} />
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <span className="max-w-[220px] truncate font-semibold text-slate-900">
                        {enrollment.student.fullName}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-slate-600">
                    {enrollment.student.email}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-slate-600">
                    {formatDate(enrollment.enrolledAt)}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex min-w-[180px] items-center gap-3">
                      <Progress value={progress} className="flex-1" />
                      <span className="w-10 text-right text-sm font-semibold tabular-nums text-slate-700">
                        {progress}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
