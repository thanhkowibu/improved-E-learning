"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpDown,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApi, type ApiResponse } from "@/hooks/useApi";

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

interface BulkEnrollResponse {
  addedCount: number;
  matchedCount: number;
  skippedCount: number;
}

interface BulkDeleteResponse {
  deletedCount: number;
}

interface UserSearchResult {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

type SortColumn = "enrolledAt" | "progressPercentage";
type SortDirection = "asc" | "desc";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
            <Skeleton className="size-4 rounded" />
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
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

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

  const visibleUserIds = useMemo(
    () => sortedStudents.map((enrollment) => enrollment.student.id),
    [sortedStudents],
  );
  const selectedUserIdSet = useMemo(
    () => new Set(selectedUserIds),
    [selectedUserIds],
  );
  const allVisibleSelected =
    visibleUserIds.length > 0 &&
    visibleUserIds.every((userId) => selectedUserIdSet.has(userId));

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
        setError(
          res.error ?? res.message ?? "Không thể tải danh sách sinh viên.",
        );
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

  useEffect(() => {
    setSelectedUserIds((current) =>
      current.filter((userId) => visibleUserIds.includes(userId)),
    );
  }, [visibleUserIds]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    let isCurrent = true;
    setIsSearching(true);

    const timer = window.setTimeout(async () => {
      const res = await api.get<UserSearchResult[]>(
        `/api/users/search?q=${encodeURIComponent(query)}`,
      );

      if (!isCurrent) return;

      if (res.success && res.data) {
        const selectedSet = new Set(selectedEmails);
        setSuggestions(res.data.filter((user) => !selectedSet.has(user.email)));
      } else {
        setSuggestions([]);
      }
      setIsSearching(false);
    }, 250);

    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedEmails]);

  function addEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      toast.error("Email không hợp lệ.");
      return;
    }

    setSelectedEmails((current) =>
      current.includes(normalized) ? current : [...current, normalized],
    );
    setSearchQuery("");
    setSuggestions([]);
  }

  function removeEmail(email: string) {
    setSelectedEmails((current) => current.filter((item) => item !== email));
  }

  function toggleUser(userId: string) {
    setSelectedUserIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  function toggleAllVisible(checked: boolean) {
    setSelectedUserIds(checked ? visibleUserIds : []);
  }

  async function handleBulkEnroll() {
    if (selectedEmails.length === 0) {
      toast.error("Vui lòng chọn hoặc nhập ít nhất một email sinh viên.");
      return;
    }

    setIsBulkSubmitting(true);
    const toastId = toast.loading("Đang thêm sinh viên vào khóa học...");

    const res = await api.post<BulkEnrollResponse>(
      `/api/courses/${courseId}/enroll-bulk`,
      { emails: selectedEmails },
    );

    if (res.success && res.data) {
      toast.success(`Đã thêm ${res.data.addedCount} sinh viên.`, {
        id: toastId,
      });
      setSelectedEmails([]);
      setSearchQuery("");
      setSuggestions([]);
      setIsBulkDialogOpen(false);
      await loadStudents();
    } else {
      toast.error(res.error ?? res.message ?? "Không thể thêm sinh viên.", {
        id: toastId,
      });
    }

    setIsBulkSubmitting(false);
  }

  async function handleBulkDelete() {
    if (selectedUserIds.length === 0) return;

    setIsBulkDeleting(true);
    const toastId = toast.loading("Đang xóa sinh viên khỏi khóa học...");

    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("auth_token")
          : null;
      const response = await fetch(`/api/courses/${courseId}/enroll-bulk`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ userIds: selectedUserIds }),
      });
      const json = (await response.json()) as ApiResponse<BulkDeleteResponse>;

      if (!json.success || !json.data) {
        throw new Error(
          json.error ?? json.message ?? "Không thể xóa sinh viên.",
        );
      }

      toast.success(`Đã xóa ${json.data.deletedCount} sinh viên.`, {
        id: toastId,
      });
      setSelectedUserIds([]);
      setIsDeleteDialogOpen(false);
      await loadStudents();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không thể xóa sinh viên.",
        { id: toastId },
      );
    } finally {
      setIsBulkDeleting(false);
    }
  }

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
          <p className="font-semibold text-slate-800">
            Không thể tải sinh viên
          </p>
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Sinh viên</h2>
          <p className="mt-1 text-sm text-slate-500">
            {total} sinh viên đang được theo dõi tiến độ trong khóa học này.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedUserIds.length > 0 && (
            <Button
              type="button"
              variant="destructive"
              className="gap-2 rounded-xl"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 size={16} />
              Xóa {selectedUserIds.length} sinh viên
            </Button>
          )}
          <Button
            type="button"
            className="gap-2 rounded-xl bg-sky-500 text-white hover:bg-sky-600"
            onClick={() => setIsBulkDialogOpen(true)}
          >
            <Plus size={16} />
            Thêm sinh viên
          </Button>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-sky-50">
            <Users size={28} className="text-sky-300" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">
              Chưa có sinh viên nào
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Dùng nút "Thêm sinh viên" để thêm sinh viên vào khóa học nội bộ.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 px-4 py-3">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={(checked) =>
                      toggleAllVisible(Boolean(checked))
                    }
                    aria-label="Chọn tất cả sinh viên"
                  />
                </TableHead>
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
                const isSelected = selectedUserIdSet.has(enrollment.student.id);

                return (
                  <TableRow key={enrollment.id}>
                    <TableCell className="px-4 py-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() =>
                          toggleUser(enrollment.student.id)
                        }
                        aria-label={`Chọn ${enrollment.student.fullName}`}
                      />
                    </TableCell>
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
                        <span className="max-w-55 truncate font-semibold text-slate-900">
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
                      <div className="flex min-w-45 items-center gap-3">
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
      )}

      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Thêm sinh viên</DialogTitle>
            <DialogDescription>
              Tìm sinh viên theo tên hoặc email, hoặc nhập email đầy đủ rồi nhấn
              Enter.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  addEmail(searchQuery);
                }}
                placeholder="Tìm theo tên, email hoặc nhập email rồi nhấn Enter..."
                disabled={isBulkSubmitting}
                className="h-11 rounded-xl pl-9"
              />
              {(isSearching || suggestions.length > 0) && (
                <div className="absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                  {isSearching ? (
                    <div className="flex items-center gap-2 px-3 py-3 text-sm text-slate-500">
                      <Loader2 size={14} className="animate-spin" />
                      Đang tìm kiếm...
                    </div>
                  ) : (
                    suggestions.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-sky-50"
                        onClick={() => addEmail(user.email)}
                      >
                        <Avatar className="size-8">
                          <AvatarImage src={user.avatarUrl ?? undefined} />
                          <AvatarFallback className="bg-sky-100 text-xs font-bold text-sky-700">
                            {getInitials(user.fullName) || (
                              <UserRound size={14} />
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {user.fullName}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {user.email}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedEmails.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedEmails.map((email) => (
                  <Badge
                    key={email}
                    variant="secondary"
                    className="h-7 gap-1 rounded-full pl-3 pr-1"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeEmail(email)}
                      className="rounded-full p-0.5 hover:bg-slate-200"
                      aria-label={`Xóa ${email}`}
                    >
                      <X size={12} />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isBulkSubmitting}
              onClick={() => setIsBulkDialogOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              disabled={isBulkSubmitting || selectedEmails.length === 0}
              onClick={() => void handleBulkEnroll()}
              className="gap-2 bg-sky-500 text-white hover:bg-sky-600"
            >
              {isBulkSubmitting && (
                <Loader2 size={15} className="animate-spin" />
              )}
              Thêm {selectedEmails.length} sinh viên
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa sinh viên khỏi khóa học?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa {selectedUserIds.length} sinh viên khỏi
              khóa học này? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isBulkDeleting}
              onClick={(event) => {
                event.preventDefault();
                void handleBulkDelete();
              }}
              className="gap-2"
            >
              {isBulkDeleting && <Loader2 size={14} className="animate-spin" />}
              Xóa sinh viên
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
