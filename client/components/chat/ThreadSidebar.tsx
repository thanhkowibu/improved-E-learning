"use client";

import { useState } from "react";
import { MessageSquare, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface ChatThreadSummary {
  id: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface ThreadSidebarProps {
  threads: ChatThreadSummary[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onCreateNew: () => void;
  onDeleteThread: (threadId: string) => void;
}

function formatThreadTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Cuộc trò chuyện gần đây";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ThreadSidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onCreateNew,
  onDeleteThread,
}: ThreadSidebarProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingThread = threads.find((thread) => thread.id === pendingDeleteId);

  return (
    <>
      <div className="flex w-full shrink-0 flex-col gap-2 border-b bg-background p-2 md:hidden">
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full justify-start gap-2"
          onClick={onCreateNew}
        >
          <Plus className="size-4 text-blue-600" />
          Cuộc trò chuyện mới
        </Button>

        <div className="flex min-w-0 items-center gap-2">
          <Select
            value={activeThreadId}
            onValueChange={(value) => {
              if (value) onSelectThread(value);
            }}
          >
            <SelectTrigger
              className="h-9 min-w-0 flex-1"
              disabled={threads.length === 0}
            >
              <SelectValue>
                {activeThreadId
                  ? formatThreadTime(
                      threads.find((thread) => thread.id === activeThreadId)
                        ?.updatedAt ?? new Date(),
                    )
                  : "Chọn cuộc trò chuyện"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="start" className="max-h-72">
              {threads.map((thread) => (
                <SelectItem key={thread.id} value={thread.id}>
                  <span className="flex min-w-0 items-center gap-2">
                    <MessageSquare className="size-4 shrink-0 text-blue-600" />
                    <span className="truncate">
                      {formatThreadTime(thread.updatedAt)}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={!activeThreadId}
            className="h-9 w-9 shrink-0 text-muted-foreground hover:bg-red-50 hover:text-red-600"
            aria-label="Xóa cuộc trò chuyện hiện tại"
            onClick={() => {
              if (activeThreadId) setPendingDeleteId(activeThreadId);
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <aside className="hidden h-full min-h-0 w-72 shrink-0 flex-col border-r bg-background md:flex">
        <div className="border-b p-3">
          <Button
            type="button"
            variant="outline"
            className="h-9 w-full justify-start gap-2"
            onClick={onCreateNew}
          >
            <Plus className="size-4 text-blue-600" />
            Cuộc trò chuyện mới
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-1 p-2">
            {threads.map((thread) => {
              const isActive = thread.id === activeThreadId;

              return (
                <div
                  key={thread.id}
                  className={cn(
                    "group/thread flex w-full items-center gap-1 rounded-lg transition-colors",
                    isActive
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectThread(thread.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <MessageSquare className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">
                      {formatThreadTime(thread.updatedAt)}
                    </span>
                  </button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="mr-1 shrink-0 text-muted-foreground opacity-70 hover:bg-red-50 hover:text-red-600 group-hover/thread:opacity-100"
                    aria-label="Xóa cuộc trò chuyện"
                    onClick={() => setPendingDeleteId(thread.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </aside>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa cuộc trò chuyện?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa cuộc trò chuyện{" "}
              {pendingThread ? `"${formatThreadTime(pendingThread.updatedAt)}"` : "này"}
              ? Toàn bộ lịch sử trao đổi sẽ bị xóa vĩnh viễn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingDeleteId) onDeleteThread(pendingDeleteId);
                setPendingDeleteId(null);
              }}
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
