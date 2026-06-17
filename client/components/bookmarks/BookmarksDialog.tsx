"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useApi } from "@/hooks/useApi";

interface BookmarksDialogProps {
  courseId: string;
  refreshKey?: number;
}

interface BookmarkItem {
  id: string;
  createdAt: string;
  lesson: {
    id: string;
    title: string;
    module: {
      id: string;
      title: string;
    };
  };
}

export function BookmarksDialog({
  courseId,
  refreshKey = 0,
}: BookmarksDialogProps) {
  const api = useApi();
  const [open, setOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBookmarks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const res = await api.get<BookmarkItem[]>(
      `/api/courses/${courseId}/bookmarks`,
    );

    if (res.success && res.data) {
      setBookmarks(res.data);
    } else {
      setError(
        res.error ?? res.message ?? "Không thể tải danh sách bài học đã lưu.",
      );
      setBookmarks([]);
    }

    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  useEffect(() => {
    if (open) void loadBookmarks();
  }, [open, refreshKey, loadBookmarks]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-lg text-slate-600 hover:bg-sky-50 hover:text-sky-700"
          />
        }
      >
        <Bookmark size={15} className="text-sky-500" />
        Đã lưu
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-slate-100 px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2">
            <Bookmark size={18} className="text-sky-500" />
            Bài học đã lưu
          </DialogTitle>
          <DialogDescription>
            Mở nhanh các bài học bạn đã đánh dấu trong khóa học này.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin text-sky-500" />
              Đang tải bài học đã lưu...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-50">
                <BookOpen size={24} className="text-slate-300" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">
                  Bạn chưa lưu bài học nào trong khóa này
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Nhấn biểu tượng đánh dấu bên cạnh bài học để lưu lại.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {bookmarks.map((bookmark) => (
                <Link
                  key={bookmark.id}
                  href={`/courses/${courseId}/lessons/${bookmark.lesson.id}`}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-3 transition-colors hover:bg-sky-50"
                >
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {bookmark.lesson.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    Thuộc: {bookmark.lesson.module.title}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
