"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type EnrollmentStatusFilter = "ALL" | "ACTIVE" | "COMPLETED" | "DROPPED";

interface CourseStatusTabsProps {
  status?: "ACTIVE" | "COMPLETED" | "DROPPED";
}

export function CourseStatusTabs({ status }: CourseStatusTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value: EnrollmentStatusFilter = status ?? "ALL";

  function handleValueChange(nextValue: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextValue === "ALL") {
      params.delete("status");
    } else {
      params.set("status", nextValue);
    }
    params.set("page", "1");

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  return (
    <Tabs value={value} onValueChange={handleValueChange}>
      <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 sm:w-fit">
        <TabsTrigger
          value="ALL"
          className="px-3 data-[state=active]:bg-sky-500 data-[state=active]:text-white data-active:bg-sky-500 data-active:text-white"
        >
          Tất cả
        </TabsTrigger>
        <TabsTrigger
          value="ACTIVE"
          className="px-3 data-[state=active]:bg-sky-500 data-[state=active]:text-white data-active:bg-sky-500 data-active:text-white"
        >
          Đang học
        </TabsTrigger>
        <TabsTrigger
          value="COMPLETED"
          className="px-3 data-[state=active]:bg-sky-500 data-[state=active]:text-white data-active:bg-sky-500 data-active:text-white"
        >
          Đã hoàn thành
        </TabsTrigger>
        <TabsTrigger
          value="DROPPED"
          className="px-3 data-[state=active]:bg-sky-500 data-[state=active]:text-white data-active:bg-sky-500 data-active:text-white"
        >
          Đã hủy
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
