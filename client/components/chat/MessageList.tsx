"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
}

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

function isGeminiWarning(text: string): boolean {
  const normalized = text.toLowerCase();

  return (
    normalized.includes("safety filter") ||
    normalized.includes("safety block") ||
    normalized.includes("blocked the prompt") ||
    normalized.includes("gemini blocked") ||
    normalized.includes("finish reason: safety") ||
    normalized.includes("ai tutor is not ready") ||
    normalized.includes("failed to generate")
  );
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <ScrollArea className="h-full min-h-0 w-full">
      <div className="flex min-h-full flex-col gap-4 px-4 py-5">
        {messages.map((message) => {
          const isUser = message.role === "user";
          const isWarning = !isUser && isGeminiWarning(message.text);

          return (
            <div
              key={message.id}
              className={cn(
                "flex w-full",
                isUser ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[min(80%,42rem)] rounded-lg px-4 py-3 text-sm leading-6 shadow-sm",
                  "wrap-break-word",
                  isUser
                    ? "bg-blue-600 text-white"
                    : "bg-muted/50 text-foreground",
                )}
              >
                {isWarning ? (
                  <Alert
                    variant="destructive"
                    className="border-red-200 bg-red-50/80"
                  >
                    <AlertTriangle className="size-4" />
                    <AlertTitle>Gemini safety warning</AlertTitle>
                    <AlertDescription className="wrap-break-word">
                      {message.text}
                    </AlertDescription>
                  </Alert>
                ) : isUser ? (
                  <p className="whitespace-pre-wrap">{message.text}</p>
                ) : (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {message.text}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading ? (
          <div className="flex w-full justify-start">
            <div className="w-full max-w-[min(80%,42rem)] rounded-lg bg-muted/50 px-4 py-3 shadow-sm">
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4 rounded-full" />
                <Skeleton className="h-4 w-full rounded-full" />
                <Skeleton className="h-4 w-2/3 rounded-full" />
              </div>
            </div>
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
