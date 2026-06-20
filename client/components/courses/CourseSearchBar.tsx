"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CourseSearchBarProps {
  initialSearch?: string;
  id?: string;
  placeholder?: string;
  className?: string;
}

export function CourseSearchBar({
  initialSearch = "",
  id = "course-search",
  placeholder = "Tìm khóa học theo tiêu đề...",
  className,
}: CourseSearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialSearch);

  useEffect(() => {
    setValue(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    const search = value.trim();
    if (search === initialSearch) return;

    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (search) {
        params.set("search", search);
      } else {
        params.delete("search");
      }
      params.set("page", "1");

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [initialSearch, pathname, router, searchParams, value]);

  return (
    <div className={cn("flex max-w-xl flex-col gap-3 sm:flex-row", className)}>
      <div className="relative min-w-0 flex-1">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <Input
          id={id}
          type="search"
          placeholder={placeholder}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-11 rounded-xl border-slate-200 bg-white pl-10 text-sm shadow-sm focus-visible:ring-sky-400"
        />
      </div>
      {value && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setValue("")}
          className="shrink-0 text-slate-500 hover:text-slate-700"
        >
          Xóa
        </Button>
      )}
    </div>
  );
}
