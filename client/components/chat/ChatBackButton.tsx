"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ChatBackButtonProps {
  fallbackHref: string;
}

export function ChatBackButton({ fallbackHref }: ChatBackButtonProps) {
  const router = useRouter();

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="mb-2 gap-1.5"
      onClick={handleBack}
    >
      <ChevronLeft className="size-4" />
      Go Back
    </Button>
  );
}
