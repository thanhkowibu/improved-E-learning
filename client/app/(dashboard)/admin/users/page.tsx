"use client";

/**
 * app/(dashboard)/admin/users/page.tsx
 *
 * Admin User Management page.
 *
 * Features:
 *   - Paginated table of all platform users (Name, Email, Role badge, Status badge)
 *   - Search/filter by name or email (client-side for simplicity)
 *   - Toggle active/inactive status with optimistic UI update
 *   - Visual feedback via role-coloured badges and status indicators
 *
 * Data: GET /api/users?page=N&limit=20
 * Mutate: PATCH /api/users/:userId/status  { isActive: boolean }
 */

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Search,
  ShieldCheck,
  ArrowLeft,
  UserCheck,
  UserX,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserItem {
  id: string;
  fullName: string;
  email: string;
  role: "ADMIN" | "TEACHER" | "STUDENT";
  isActive: boolean;
  createdAt: string;
}

// ─── Badge maps ───────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, string> = {
  ADMIN: "bg-violet-100 text-violet-700 hover:bg-violet-100",
  TEACHER: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  STUDENT: "bg-sky-100 text-sky-700 hover:bg-sky-100",
};

// ─── Avatar initials ──────────────────────────────────────────────────────────

function UserAvatar({ name, isActive }: { name: string; isActive: boolean }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={`h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 transition-opacity ${
        isActive
          ? "bg-gradient-to-br from-sky-400 to-sky-600"
          : "bg-gradient-to-br from-slate-300 to-slate-400 opacity-60"
      }`}
    >
      {initials}
    </div>
  );
}

// ─── Table Skeleton ───────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="h-3 w-56 rounded" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const api = useApi();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Auth guard: redirect non-admins
  useEffect(() => {
    if (!authLoading && user && user.role !== "ADMIN") {
      router.replace("/");
    }
  }, [authLoading, user, router]);

  const fetchUsers = (pg = page) => {
    setLoading(true);
    setError(null);
    api
      .get<{ items: UserItem[]; total: number }>(
        `/api/users?page=${pg}&limit=${PAGE_SIZE}`
      )
      .then((res) => {
        if (res.success && res.data) {
          setUsers(res.data.items);
          setTotal(res.data.total);
        } else {
          setError(res.error ?? "Failed to load users.");
        }
      })
      .catch(() => setError("An unexpected error occurred."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!authLoading && user?.role === "ADMIN") fetchUsers(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, authLoading, user?.role]);

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, search]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const toggleStatus = async (targetUser: UserItem) => {
    setTogglingId(targetUser.id);
    const newStatus = !targetUser.isActive;

    // Optimistic update
    setUsers((prev) =>
      prev.map((u) =>
        u.id === targetUser.id ? { ...u, isActive: newStatus } : u
      )
    );

    const res = await api.patch<UserItem>(
      `/api/users/${targetUser.id}/status`,
      { isActive: newStatus }
    );

    if (!res.success) {
      // Revert on failure
      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetUser.id ? { ...u, isActive: !newStatus } : u
        )
      );
    }
    setTogglingId(null);
  };

  if (authLoading) {
    return (
      <div className="mx-auto px-6 md:px-12 lg:px-24 max-w-7xl py-10">
        <Skeleton className="h-10 w-48 rounded-xl mb-8" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!user || user.role !== "ADMIN") return null;

  return (
    <div className="mx-auto px-6 md:px-12 lg:px-24 max-w-7xl py-10">
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-slate-500 hover:text-slate-700 -ml-2"
              >
                <ArrowLeft size={14} />
                Dashboard
              </Button>
            </Link>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchUsers(page)}
            disabled={loading}
            className="gap-1.5 text-slate-600"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-violet-100 flex items-center justify-center">
            <Users size={20} className="text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              User Management
            </h1>
            <p className="text-slate-500 text-sm">
              {total.toLocaleString()} registered user
              {total !== 1 ? "s" : ""} on the platform
            </p>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: "Total Users",
              value: total,
              colorClass: "text-violet-600",
              bgClass: "bg-violet-50",
            },
            {
              label: "Active",
              value: users.filter((u) => u.isActive).length,
              colorClass: "text-emerald-600",
              bgClass: "bg-emerald-50",
            },
            {
              label: "Inactive",
              value: users.filter((u) => !u.isActive).length,
              colorClass: "text-red-500",
              bgClass: "bg-red-50",
            },
            {
              label: "On This Page",
              value: filtered.length,
              colorClass: "text-sky-600",
              bgClass: "bg-sky-50",
            },
          ].map(({ label, value, colorClass, bgClass }) => (
            <Card
              key={label}
              className="border border-slate-200/80 shadow-sm bg-white"
            >
              <CardContent className="p-4">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {label}
                </p>
                <p className={`mt-1 text-2xl font-extrabold ${colorClass} tabular-nums`}>
                  {value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Search ── */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            placeholder="Search by name, email, or role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white border-slate-200 rounded-xl h-10 focus-visible:ring-sky-500"
          />
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchUsers(page)}
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              Retry
            </Button>
          </div>
        )}

        {/* ── Table ── */}
        <Card className="border border-slate-200/80 shadow-sm bg-white overflow-hidden">
          <CardHeader className="px-6 py-4 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck size={16} className="text-violet-500" />
              Users — Page {page} of {totalPages || 1}
            </CardTitle>
          </CardHeader>

          {loading ? (
            <TableSkeleton />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                <Users size={24} className="text-slate-300" />
              </div>
              <p className="text-slate-500 text-sm">
                {search ? `No users match "${search}"` : "No users found."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="pl-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    User
                  </TableHead>
                  <TableHead className="py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Role
                  </TableHead>
                  <TableHead className="py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Status
                  </TableHead>
                  <TableHead className="py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Joined
                  </TableHead>
                  <TableHead className="pr-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow
                    key={u.id}
                    className={`transition-colors ${!u.isActive ? "opacity-60 bg-slate-50/40" : "hover:bg-slate-50/50"}`}
                  >
                    {/* User cell */}
                    <TableCell className="pl-6 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={u.fullName} isActive={u.isActive} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {u.fullName}
                            {u.id === user.id && (
                              <span className="ml-1.5 text-[10px] text-sky-500 font-normal">
                                (you)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Role */}
                    <TableCell className="py-3">
                      <Badge
                        className={`text-[11px] font-semibold ${ROLE_BADGE[u.role] ?? ""}`}
                      >
                        {u.role}
                      </Badge>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-3">
                      <Badge
                        className={
                          u.isActive
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[11px] font-semibold"
                            : "bg-red-100 text-red-600 hover:bg-red-100 text-[11px] font-semibold"
                        }
                      >
                        {u.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>

                    {/* Joined date */}
                    <TableCell className="py-3 text-xs text-slate-400">
                      {new Date(u.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>

                    {/* Action */}
                    <TableCell className="pr-6 py-3 text-right">
                      {u.id === user.id ? (
                        <span className="text-xs text-slate-300 italic">
                          Cannot edit self
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={togglingId === u.id}
                          onClick={() => toggleStatus(u)}
                          className={
                            u.isActive
                              ? "h-8 px-3 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 gap-1.5 text-xs font-medium"
                              : "h-8 px-3 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 gap-1.5 text-xs font-medium"
                          }
                        >
                          {togglingId === u.id ? (
                            <RefreshCw size={11} className="animate-spin" />
                          ) : u.isActive ? (
                            <>
                              <UserX size={12} />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck size={12} />
                              Reactivate
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* ── Pagination ── */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
              <p className="text-xs text-slate-400">
                Showing {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, total)} of {total} users
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="h-8 px-2.5 border-slate-200"
                >
                  <ChevronLeft size={14} />
                </Button>
                <span className="text-xs text-slate-600 font-medium tabular-nums px-1">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8 px-2.5 border-slate-200"
                >
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
