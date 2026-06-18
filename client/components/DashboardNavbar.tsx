"use client";

/**
 * components/DashboardNavbar.tsx
 *
 * Top bar for the authenticated dashboard layout.
 * Contains:
 *   - Page title / breadcrumb area (left)
 *   - Notification bell + Avatar dropdown (right)
 *
 * Separate from the public Navbar.tsx — the dashboard has a sidebar
 * so the top bar is narrower and role-contextual.
 */

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, User, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const ROLE_STYLES: Record<string, string> = {
  ADMIN: "bg-violet-100 text-violet-700",
  TEACHER: "bg-amber-100 text-amber-700",
  STUDENT: "bg-sky-100 text-sky-700",
};

interface DashboardNavbarProps {
  title?: string;
}

export default function DashboardNavbar({
  title = "Bảng điều khiển",
}: DashboardNavbarProps) {
  const { user, logout, isLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="h-16 shrink-0 flex items-center justify-between px-6 bg-white border-b border-slate-200">
      {/* Left: page title */}
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {/* Avatar dropdown */}
        {isLoading ? (
          <div className="h-9 w-32 rounded-xl bg-slate-100 animate-pulse" />
        ) : user ? (
          <div className="relative" ref={ref}>
            <button
              id="dashboard-avatar-btn"
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-2 rounded-xl pl-1 pr-2.5 py-1 hover:bg-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-sky-400"
              aria-haspopup="true"
              aria-expanded={open}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-sky-500 via-25% via-sky-400 to-cyan-400 text-xs font-bold text-white shadow-sm">
                {getInitials(user.fullName)}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-slate-800 leading-none">
                  {user.fullName.split(" ")[0]}
                </p>
                <p
                  className={cn(
                    "text-[10px] font-medium mt-0.5 px-1 rounded-sm",
                    ROLE_STYLES[user.role],
                  )}
                >
                  {user.role}
                </p>
              </div>
              <ChevronDown
                size={14}
                className={cn(
                  "text-slate-400 transition-transform duration-200",
                  open && "rotate-180",
                )}
              />
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white shadow-lg ring-1 ring-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                {/* User info */}
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <p className="text-sm font-semibold text-slate-900">
                    {user.fullName}
                  </p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {user.email}
                  </p>
                </div>

                {/* Links */}
                <div className="py-1">
                  <Link
                    href="/settings"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <User size={15} className="text-slate-400" />
                    Cài đặt hồ sơ
                  </Link>
                </div>

                {/* Logout */}
                <div className="border-t border-slate-100 py-1">
                  <button
                    id="dashboard-logout-btn"
                    onClick={() => {
                      setOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={15} />
                    Đăng xuất
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
}
