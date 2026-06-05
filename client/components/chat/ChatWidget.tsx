"use client";

import { useCallback, useEffect, useState } from "react";
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
import { useApi } from "@/hooks/useApi";

interface ChatWidgetProps {
  courseId: string;
}

interface ApiThread {
  id: string;
  createdAt: string;
  updatedAt: string;
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

export function ChatWidget({ courseId }: ChatWidgetProps) {
  const api = useApi();
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isThreadLoading, setIsThreadLoading] = useState(true);

  const loadThreads = useCallback(async () => {
    setIsThreadLoading(true);

    try {
      const response = await api.get<ApiThread[]>(
        `/api/courses/${courseId}/chat/threads`
      );

      if (!response.success || !response.data) {
        throw new Error(response.message ?? "Failed to load chat threads.");
      }

      const loadedThreads = response.data;
      setThreads(loadedThreads);
      setActiveThreadId((current) => current ?? loadedThreads[0]?.id ?? null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load chat threads."
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
        `/api/chat/threads/${activeThreadId}/messages`
      );

      if (!response.success || !response.data) {
        throw new Error(response.message ?? "Failed to load chat messages.");
      }

      setMessages(response.data.map(toMessageListItem));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load chat messages."
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
        { courseId }
      );

      if (!response.success || !response.data) {
        throw new Error(response.message ?? "Failed to create a new chat.");
      }

      const createdThread = response.data;
      setThreads((current) => [createdThread, ...current]);
      setActiveThreadId(createdThread.id);
      setMessages([]);
      toast.success("New chat created.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create a new chat."
      );
    }
  }

  async function handleSendMessage(text: string) {
    let threadId = activeThreadId;

    try {
      if (!threadId) {
        const createResponse = await api.post<ApiThread>(
          `/api/courses/${courseId}/chat/threads`,
          { courseId }
        );

        if (!createResponse.success || !createResponse.data) {
          throw new Error(
            createResponse.message ?? "Failed to create a chat thread."
          );
        }

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
        { message: text }
      );

      if (!response.success || !response.data) {
        throw new Error(response.message ?? "Failed to send message.");
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
        current.filter((message) => !message.id.startsWith("optimistic-"))
      );
      toast.error(
        error instanceof Error ? error.message : "Failed to send message."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-[600px] min-h-0 overflow-hidden rounded-lg border bg-background shadow-sm">
      <ThreadSidebar
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={setActiveThreadId}
        onCreateNew={handleCreateThread}
      />

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <MessageList
            messages={messages}
            isLoading={isLoading || isThreadLoading}
          />
        </div>
        <ChatInput onSend={handleSendMessage} isLoading={isLoading} />
      </section>
    </div>
  );
}
