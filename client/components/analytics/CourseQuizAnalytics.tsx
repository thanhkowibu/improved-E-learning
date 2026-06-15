"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpDown, BarChart3, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApi } from "@/hooks/useApi";

interface CourseQuizAnalyticsProps {
  courseId: string;
}

interface QuizAnalyticsRow {
  quizId: string;
  lessonId: string;
  quizTitle: string;
  totalSubmissions: number;
  averageScore: number;
}

type SortColumn = "quizTitle" | "totalSubmissions" | "averageScore";
type SortDirection = "asc" | "desc";

function QuizAnalyticsSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="grid gap-4 md:grid-cols-[1fr_160px_200px_120px]"
          >
            <Skeleton className="h-6 rounded-lg" />
            <Skeleton className="h-6 rounded-lg" />
            <Skeleton className="h-6 rounded-lg" />
            <Skeleton className="h-6 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CourseQuizAnalytics({ courseId }: CourseQuizAnalyticsProps) {
  const api = useApi();
  const [rows, setRows] = useState<QuizAnalyticsRow[]>([]);
  const [sortColumn, setSortColumn] = useState<SortColumn>("quizTitle");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const comparison =
        sortColumn === "quizTitle"
          ? a.quizTitle.localeCompare(b.quizTitle, "vi")
          : a[sortColumn] - b[sortColumn];

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [rows, sortColumn, sortDirection]);

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortColumn(column);
    setSortDirection("asc");
  }

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await api.get<QuizAnalyticsRow[]>(
        `/api/courses/${courseId}/analytics/quizzes`,
      );

      if (res.success && res.data) {
        setRows(res.data);
      } else {
        setError(res.error ?? res.message ?? "Không thể tải thống kê quiz.");
      }
    } catch {
      setError("Đã xảy ra lỗi khi tải thống kê quiz.");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  if (isLoading) {
    return <QuizAnalyticsSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white py-14 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-red-50">
          <AlertCircle size={28} className="text-red-400" />
        </div>
        <div>
          <p className="font-semibold text-slate-800">Không thể tải thống kê</p>
          <p className="mt-1 text-sm text-slate-500">{error}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl border-sky-300 text-sky-600 hover:bg-sky-50"
          onClick={() => void loadAnalytics()}
        >
          Thử lại
        </Button>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-sky-50">
          <ClipboardList size={28} className="text-sky-300" />
        </div>
        <div>
          <p className="font-semibold text-slate-800">
            Chưa có bài kiểm tra nào
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Khi khóa học có quiz và sinh viên nộp bài, thống kê sẽ hiển thị tại
            đây.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-sky-500" />
          <h2 className="text-xl font-bold text-slate-900">Thống kê quiz</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Theo dõi số lượt nộp bài và điểm trung bình của từng bài kiểm tra.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort("quizTitle")}
                  className="inline-flex items-center font-medium text-slate-700 transition-colors hover:text-sky-600"
                >
                  Tên Bài kiểm tra
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </button>
              </TableHead>
              <TableHead className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort("totalSubmissions")}
                  className="inline-flex items-center font-medium text-slate-700 transition-colors hover:text-sky-600"
                >
                  Số lượt nộp bài
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </button>
              </TableHead>
              <TableHead className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort("averageScore")}
                  className="inline-flex items-center font-medium text-slate-700 transition-colors hover:text-sky-600"
                >
                  Điểm trung bình cả lớp
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </button>
              </TableHead>
              <TableHead className="px-4 py-3 text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row) => (
              <TableRow key={row.quizId}>
                <TableCell className="max-w-90 truncate px-4 py-3 font-semibold text-slate-900">
                  {row.quizTitle}
                </TableCell>
                <TableCell className="px-4 py-3 text-slate-600">
                  {row.totalSubmissions}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <span className="font-semibold tabular-nums text-slate-800">
                    {row.averageScore}%
                  </span>
                </TableCell>
                <TableCell className="px-4 py-3 text-right">
                  <Link
                    href={`/courses/${courseId}/analytics/quizzes/${row.lessonId}`}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-sky-300 text-sky-600 hover:bg-sky-50"
                    >
                      Xem chi tiết
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
