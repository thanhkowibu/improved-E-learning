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
  onDeleteThread,
}: ThreadSidebarProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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
              <div
                key={thread.id}
                className={cn(
                  "group/thread flex w-full items-center gap-1 rounded-lg transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
                  aria-label="Delete chat"
                  onClick={() => setPendingDeleteId(thread.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>

                <AlertDialog
                  open={pendingDeleteId === thread.id}
                  onOpenChange={(open) => {
                    if (!open) setPendingDeleteId(null);
                  }}
                >
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Chat?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this chat? This will
                        permanently remove the conversation history.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() => {
                          onDeleteThread(thread.id);
                          setPendingDeleteId(null);
                        }}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}
