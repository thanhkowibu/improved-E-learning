"use client";

import { useState, type KeyboardEvent } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  onSend: (message: string) => void | Promise<void>;
  isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [text, setText] = useState("");
  const trimmedText = text.trim();
  const isDisabled = isLoading || trimmedText.length === 0;

  function handleSend() {
    if (isDisabled) return;

    void onSend(trimmedText);
    setText("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    handleSend();
  }

  return (
    <div className="border-t bg-background px-4 py-3">
      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder="Hỏi trợ giảng AI..."
          rows={2}
          className="max-h-40 min-h-12 resize-none"
          aria-label="Tin nhắn trò chuyện"
        />
        <Button
          type="button"
          onClick={handleSend}
          disabled={isDisabled}
          size="icon-lg"
          aria-label="Gửi tin nhắn"
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
