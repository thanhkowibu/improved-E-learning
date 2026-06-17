"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Maximize2 } from "lucide-react";
import { toast } from "sonner";

import {
  MessageList,
  type ChatMessage as MessageListItem,
} from "@/components/chat/MessageList";
import {
  ThreadSidebar,
  type ChatThreadSummary,
} from "@/components/chat/ThreadSidebar";
import { ChatInput } from "@/components/chat/ChatInput";
import { buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";

interface ChatWidgetProps {
  courseId: string;
  isStandalone?: boolean;
}

interface ApiThread {
  id: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatThreadsStatus {
  aiEnabled: false;
  message?: string;
  threads: ApiThread[];
}

interface ApiMessage {
  id: string;
  role: "user" | "model";
  content: string;
  createdAt: string;
}

interface AskResponse {
  userMessage: ApiMessage;
  assistantMessage: ApiMessage;
}

function toMessageListItem(message: ApiMessage): MessageListItem {
  return {
    id: message.id,
    role: message.role,
    text: message.content,
  };
}

function isAiUnavailableMessage(message: string): boolean {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("ai tutor is not enabled") ||
    normalized.includes("ai tutor is not ready") ||
    normalized.includes("no synced materials") ||
    normalized.includes("not configured")
  );
}

function ExpandButton({ courseId }: { courseId: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href={`/courses/${courseId}/chat`}
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
              aria-label="Open in full page"
            >
              <Maximize2 className="size-4" />
            </Link>
          }
        />
        <TooltipContent>Mở toàn trang</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function WidgetHeader({
  courseId,
  isStandalone,
}: {
  courseId: string;
  isStandalone: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b py-3 pr-12 pl-4">
      <div className="flex min-w-0 items-center gap-2">
        <Bot className="size-4 shrink-0 text-blue-600" />
        <span className="truncate text-sm font-semibold">AI Tutor</span>
      </div>
      {!isStandalone ? <ExpandButton courseId={courseId} /> : null}
    </div>
  );
}

export function ChatWidget({
  courseId,
  isStandalone = false,
}: ChatWidgetProps) {
  const api = useApi();
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isThreadLoading, setIsThreadLoading] = useState(true);
  const [aiUnavailableMessage, setAiUnavailableMessage] = useState<
    string | null
  >(null);

  const loadThreads = useCallback(async () => {
    setIsThreadLoading(true);

    try {
      const response = await api.get<ApiThread[] | ChatThreadsStatus>(
        `/api/courses/${courseId}/chat/threads`,
      );

      if (!response.success || !response.data) {
        const message = response.message ?? "Không thể tải danh sách trò chuyện.";
        if (isAiUnavailableMessage(message)) {
          setAiUnavailableMessage(message);
          setThreads([]);
          setActiveThreadId(null);
          setMessages([]);
          return;
        }

        throw new Error(message);
      }

      setAiUnavailableMessage(null);
      if (!Array.isArray(response.data)) {
        if (response.data.aiEnabled === false) {
          setAiUnavailableMessage(
            response.data.message ?? "Trợ giảng AI chưa sẵn sàng.",
          );
          setThreads([]);
          setActiveThreadId(null);
          setMessages([]);
          return;
        }

        throw new Error("Không thể tải danh sách trò chuyện.");
      }

      const loadedThreads = response.data;
      setThreads(loadedThreads);
      setActiveThreadId((current) => current ?? loadedThreads[0]?.id ?? null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể tải danh sách trò chuyện.",
      );
    } finally {
      setIsThreadLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const loadMessages = useCallback(async () => {
    if (!activeThreadId) {
      setMessages([]);
      return;
    }

    try {
      const response = await api.get<ApiMessage[]>(
        `/api/chat/threads/${activeThreadId}/messages`,
      );

      if (!response.success || !response.data) {
        throw new Error(response.message ?? "Không thể tải tin nhắn.");
      }

      setMessages(response.data.map(toMessageListItem));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không thể tải tin nhắn.",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  async function handleCreateThread() {
    if (isLoading) return;

    try {
      const response = await api.post<ApiThread>(
        `/api/courses/${courseId}/chat/threads`,
        { courseId },
      );

      if (!response.success || !response.data) {
        const message = response.message ?? "Không thể tạo cuộc trò chuyện mới.";
        if (isAiUnavailableMessage(message)) {
          setAiUnavailableMessage(message);
          return;
        }

        throw new Error(message);
      }

      setAiUnavailableMessage(null);
      const createdThread = response.data;
      setThreads((current) => [createdThread, ...current]);
      setActiveThreadId(createdThread.id);
      setMessages([]);
      toast.success("Đã tạo cuộc trò chuyện mới.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể tạo cuộc trò chuyện mới.",
      );
    }
  }

  async function handleDeleteThread(threadId: string) {
    try {
      const response = await api.del(`/api/chat/threads/${threadId}`);

      if (!response.success) {
        throw new Error(response.message ?? "Không thể xóa cuộc trò chuyện.");
      }

      const remainingThreads = threads.filter(
        (thread) => thread.id !== threadId,
      );
      setThreads(remainingThreads);

      if (activeThreadId === threadId) {
        const nextThreadId = remainingThreads[0]?.id ?? null;
        setActiveThreadId(nextThreadId);
        if (!nextThreadId) {
          setMessages([]);
        }
      }

      toast.success("Đã xóa cuộc trò chuyện.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể xóa cuộc trò chuyện.",
      );
    }
  }

  async function handleSendMessage(text: string) {
    let threadId = activeThreadId;

    try {
      if (!threadId) {
        const createResponse = await api.post<ApiThread>(
          `/api/courses/${courseId}/chat/threads`,
          { courseId },
        );

        if (!createResponse.success || !createResponse.data) {
          const message =
            createResponse.message ?? "Không thể tạo chủ đề trò chuyện.";
          if (isAiUnavailableMessage(message)) {
            setAiUnavailableMessage(message);
            return;
          }

          throw new Error(message);
        }

        setAiUnavailableMessage(null);
        const createdThread = createResponse.data;
        threadId = createdThread.id;
        setThreads((current) => [createdThread, ...current]);
        setActiveThreadId(threadId);
      }

      const optimisticMessage: MessageListItem = {
        id: `optimistic-${Date.now()}`,
        role: "user",
        text,
      };

      setMessages((current) => [...current, optimisticMessage]);
      setIsLoading(true);

      const response = await api.post<AskResponse>(
        `/api/chat/threads/${threadId}/ask`,
        { message: text },
      );

      if (!response.success || !response.data) {
        throw new Error(response.message ?? "Không thể gửi tin nhắn.");
      }

      const askData = response.data;
      setMessages((current) => [
        ...current.filter((message) => message.id !== optimisticMessage.id),
        toMessageListItem(askData.userMessage),
        toMessageListItem(askData.assistantMessage),
      ]);

      await loadThreads();
    } catch (error) {
      setMessages((current) =>
        current.filter((message) => !message.id.startsWith("optimistic-")),
      );
      toast.error(
        error instanceof Error ? error.message : "Không thể gửi tin nhắn.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (aiUnavailableMessage) {
    return (
      <div
        className={cn(
          "flex h-full flex-col overflow-hidden rounded-lg border bg-background shadow-sm",
          isStandalone ? "min-h-4" : "min-h-150",
        )}
      >
        <WidgetHeader courseId={courseId} isStandalone={isStandalone} />
        <div className="flex flex-1 items-center justify-center bg-slate-50/60 px-6 text-center">
          <div className="max-w-sm">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Bot className="size-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Trợ giảng AI chưa sẵn sàng
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Giảng viên chưa bật Trợ giảng AI hoặc chưa đồng bộ tài liệu cho
              khóa học này.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-lg border bg-background shadow-sm",
        isStandalone ? "min-h-0" : "min-h-150",
      )}
    >
      <WidgetHeader courseId={courseId} isStandalone={isStandalone} />

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <ThreadSidebar
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={setActiveThreadId}
          onCreateNew={handleCreateThread}
          onDeleteThread={handleDeleteThread}
        />

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <MessageList
              messages={messages}
              isLoading={isLoading || isThreadLoading}
            />
          </div>
          <ChatInput onSend={handleSendMessage} isLoading={isLoading} />
        </section>
      </div>
    </div>
  );
}
