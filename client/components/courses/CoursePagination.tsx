"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { MouseEvent } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface CoursePaginationProps {
  page: number;
  pages: number;
}

function getPageItems(page: number, pages: number): Array<number | "ellipsis"> {
  if (pages <= 7) {
    return Array.from({ length: pages }, (_, index) => index + 1);
  }

  const items: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pages - 1, page + 1);

  if (start > 2) items.push("ellipsis");
  for (let value = start; value <= end; value += 1) items.push(value);
  if (end < pages - 1) items.push("ellipsis");

  items.push(pages);
  return items;
}

export function CoursePagination({ page, pages }: CoursePaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pages <= 1) return null;

  function getHref(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    return `${pathname}?${params.toString()}`;
  }

  function navigate(event: MouseEvent<HTMLAnchorElement>, nextPage: number) {
    event.preventDefault();
    router.push(getHref(nextPage), { scroll: false });
  }

  return (
    <Pagination className="mt-10">
      <PaginationContent>
        {page > 1 && (
          <PaginationItem>
            <PaginationPrevious
              href={getHref(page - 1)}
              onClick={(event) => navigate(event, page - 1)}
              text="Trước"
            />
          </PaginationItem>
        )}

        {getPageItems(page, pages).map((item, index) =>
          item === "ellipsis" ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink
                href={getHref(item)}
                isActive={item === page}
                onClick={(event) => navigate(event, item)}
                className={
                  item === page
                    ? "bg-sky-500 text-white hover:bg-sky-600 hover:text-white"
                    : undefined
                }
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        {page < pages && (
          <PaginationItem>
            <PaginationNext
              href={getHref(page + 1)}
              onClick={(event) => navigate(event, page + 1)}
              text="Tiếp"
            />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
}
