"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type StickyChatTriggerProps = React.ComponentPropsWithoutRef<"button">;

export const StickyChatTrigger = React.forwardRef<
  HTMLButtonElement,
  StickyChatTriggerProps
>(({ className, type = "button", ...props }, ref) => {
  return (
    <button
      ref={ref}
      type={type}
      aria-label="Open AI Tutor"
      className={cn(
        "group fixed left-0 top-1/2 z-50 flex -translate-y-1/2 items-center justify-center gap-2 overflow-hidden rounded-l-none rounded-r-2xl border border-l-0 border-indigo-200/50 bg-white/80 px-3 py-4 text-indigo-700 shadow-2xl backdrop-blur-md animate-pulse transition-all duration-300 hover:translate-x-2 hover:cursor-ew-resize hover:bg-indigo-50/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 md:py-5",
        className,
      )}
      {...props}
    >
      <span className="absolute right-0 top-1/2 h-2/3 w-0.75 -translate-y-1/2 rounded-full bg-linear-to-b from-blue-500 to-purple-600" />
      <Sparkles
        size={18}
        className="shrink-0 text-indigo-600 transition-transform duration-300 group-hover:scale-110"
        aria-hidden="true"
      />
      <span className="hidden rotate-180 text-[11px] font-bold tracking-[0.18em] text-slate-800 [writing-mode:vertical-rl] md:inline-flex">
        AI TUTOR
      </span>
    </button>
  );
});

StickyChatTrigger.displayName = "StickyChatTrigger";
