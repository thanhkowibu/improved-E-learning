"use client";

import { MessageSquare, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
}

function formatThreadTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recent chat";
  }

  return new Intl.DateTimeFormat(undefined, {
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
}: ThreadSidebarProps) {
  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r bg-background sm:w-72">
      <div className="border-b p-3">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={onCreateNew}
        >
          <Plus className="size-4 text-blue-600" />
          New Chat
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 p-2">
          {threads.map((thread) => {
            const isActive = thread.id === activeThreadId;

            return (
              <button
                key={thread.id}
                type="button"
                onClick={() => onSelectThread(thread.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                  isActive
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <MessageSquare className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  {formatThreadTime(thread.updatedAt)}
                </span>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}
