"use client";

/**
 * components/Navbar.tsx
 *
 * Unified top navigation bar — handles both public (guest) and authenticated
 * (role-aware) states in a single sticky header.
 *
 * Layout (desktop):
 *   [Logo]  [Nav links — role-aware]        [Avatar dropdown]
 *
 * Role nav sets:
 *   Guest    → Courses
 *   STUDENT  → Courses, My Learning, Dashboard
 *   TEACHER  → Courses, Manage Courses, Create Course, Dashboard
 *   ADMIN    → All Users, All Courses, Analytics, Dashboard
 *
 * Design system:
 *   - Sky Blue primary (#0ea5e9)
 *   - White background, subtle border-b
 *   - Active link: sky accent underline + tinted text
 *   - Typography: text-xl font-extrabold tracking-tight logo
 */

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  GraduationCap,
  LogOut,
  Menu,
  Settings,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
}

// ─── Role nav maps ────────────────────────────────────────────────────────────

const GUEST_NAV: NavItem[] = [{ href: "/courses", label: "Khóa học" }];

const STUDENT_NAV: NavItem[] = [
  { href: "/courses", label: "Khóa học" },
  { href: "/my-courses", label: "Lớp học của tôi" },
  { href: "/dashboard", label: "Bảng điều khiển" },
];

const TEACHER_NAV: NavItem[] = [
  { href: "/courses", label: "Khóa học" },
  { href: "/my-courses", label: "Quản lý" },
  { href: "/courses/new", label: "Tạo khóa học" },
  { href: "/dashboard", label: "Bảng điều khiển" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin/users", label: "Người dùng" },
  { href: "/courses", label: "Khóa học" },
  { href: "/admin/analytics", label: "Thống kê" },
  { href: "/dashboard", label: "Bảng điều khiển" },
];

function getNav(role?: string): NavItem[] {
  switch (role) {
    case "TEACHER":
      return TEACHER_NAV;
    case "ADMIN":
      return ADMIN_NAV;
    case "STUDENT":
      return STUDENT_NAV;
    default:
      return GUEST_NAV;
  }
}

// ─── Role badge config ────────────────────────────────────────────────────────

const ROLE_STYLES: Record<string, string> = {
  ADMIN: "bg-violet-100 text-violet-700",
  TEACHER: "bg-amber-100  text-amber-700",
  STUDENT: "bg-sky-100    text-sky-700",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ─── NavLink ──────────────────────────────────────────────────────────────────

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  // Exact match only — prevents "/courses" highlighting on "/courses/new" etc.
  const active = pathname === item.href;

  return (
    <Link
      href={item.href}
      className={cn(
        "relative px-1 py-1 text-sm font-semibold transition-colors duration-150",
        active ? "text-sky-600" : "text-slate-600 hover:text-slate-900",
      )}
    >
      {item.label}
      {/* Active underline */}
      {active && (
        <span className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-sky-500" />
      )}
    </Link>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Navbar() {
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navItems = getNav(user?.role);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-slate-200 shadow-sm">
      <div className="container mx-auto px-6 md:px-12 lg:px-24 max-w-7xl">
        <div className="flex h-16 items-center gap-8">
          {/* ── Logo ── */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-sky-500 via-25% via-sky-400 to-cyan-400 shadow-sm transition-all group-hover:brightness-105">
              <GraduationCap size={18} className="text-white" />
            </div>
            <span className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900">
              <span className="font-handwriting text-3xl -rotate-2 pr-1 text-slate-800">
                Raku
              </span>
              <span className="text-sky-500">Learn</span>
            </span>
          </Link>

          {/* ── Nav links (desktop) ── */}
          <nav
            className="hidden md:flex items-center gap-6 flex-1"
            aria-label="Main navigation"
          >
            {navItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>

          <NavigationMenu
            className="flex flex-1 justify-start md:hidden"
            aria-label="Mobile navigation"
          >
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger className="gap-1.5 text-slate-600">
                  <Menu size={16} />
                  Menu
                </NavigationMenuTrigger>
                <NavigationMenuContent className="w-56 p-2">
                  <div className="grid gap-1">
                    {navItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                          pathname === item.href
                            ? "bg-sky-50 text-sky-700"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                        )}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          {/* ── Right actions ── */}
          <div className="ml-auto flex items-center gap-2">
            {isLoading ? (
              <div className="h-9 w-28 rounded-xl bg-slate-100 animate-pulse" />
            ) : isAuthenticated && user ? (
              <>
                {/* Avatar dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    id="navbar-avatar-btn"
                    onClick={() => setDropdownOpen((o) => !o)}
                    className="flex items-center gap-2 rounded-xl pl-1 pr-3 py-1.5 hover:bg-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none"
                    aria-haspopup="true"
                    aria-expanded={dropdownOpen}
                  >
                    {/* Avatar */}
                    <Avatar className="h-8 w-8 shrink-0 shadow-sm">
                      <AvatarImage src={user.avatarUrl ?? undefined} />
                      <AvatarFallback className="bg-linear-to-br from-sky-500 via-25% via-sky-400 to-cyan-400 text-xs font-bold text-white">
                        {getInitials(user.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    {/* Name + role */}
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-semibold text-slate-800 leading-none">
                        {user.fullName.split(" ")[0]}
                      </p>
                      <p
                        className={cn(
                          "text-[10px] font-medium mt-0.5 px-1.5 rounded-sm inline-block",
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
                        dropdownOpen && "rotate-180",
                      )}
                    />
                  </button>

                  {/* Dropdown panel */}
                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-white shadow-xl ring-1 ring-slate-200/80 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      {/* User info */}
                      <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {user.fullName}
                        </p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {user.email}
                        </p>
                        <span
                          className={cn(
                            "mt-1.5 inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full",
                            ROLE_STYLES[user.role],
                          )}
                        >
                          {user.role}
                        </span>
                      </div>

                      {/* Quick nav */}
                      <div className="py-1.5">
                        <Link
                          href="/dashboard"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <GraduationCap
                              size={14}
                              className="text-slate-500"
                            />
                          </div>
                          Bảng điều khiển
                        </Link>
                        <Link
                          href={`/profile/${user.id}`}
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <UserRound size={14} className="text-slate-500" />
                          </div>
                          Hồ sơ cá nhân
                        </Link>
                        <Link
                          href="/settings"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <Settings size={14} className="text-slate-500" />
                          </div>
                          Cài đặt
                        </Link>
                      </div>

                      {/* Logout */}
                      <div className="border-t border-slate-100 py-1.5">
                        <button
                          id="navbar-logout-btn"
                          onClick={() => {
                            setDropdownOpen(false);
                            logout();
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <div className="h-7 w-7 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                            <LogOut size={14} className="text-red-500" />
                          </div>
                          Đăng xuất
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Guest CTA buttons */
              <>
                <Link
                  id="navbar-login-btn"
                  href="/login"
                  className="hidden sm:inline-flex items-center px-4 py-2 text-sm font-semibold text-sky-600 border border-sky-300 rounded-xl hover:bg-sky-50 transition-colors"
                >
                  Đăng nhập
                </Link>
                <Link
                  id="navbar-register-btn"
                  href="/register"
                  className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-sky-500 rounded-xl hover:bg-sky-600 active:bg-sky-700 transition-colors shadow-sm"
                >
                  Bắt đầu
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
