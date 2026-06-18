"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CourseSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
}

export function CourseSearchBar({
  value,
  onChange,
  id = "course-search",
  placeholder = "Tìm khóa học theo tiêu đề...",
  className,
}: CourseSearchBarProps) {
  return (
    <div className={cn("flex max-w-xl flex-col gap-3 sm:flex-row", className)}>
      <div className="relative min-w-0 flex-1">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <Input
          id={id}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 rounded-xl border-slate-200 bg-white pl-10 text-sm shadow-sm focus-visible:ring-sky-400"
        />
      </div>
      {value && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => onChange("")}
          className="shrink-0 text-slate-500 hover:text-slate-700"
        >
          Xóa
        </Button>
      )}
    </div>
  );
}
