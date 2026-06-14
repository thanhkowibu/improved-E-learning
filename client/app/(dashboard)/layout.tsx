/**
 * app/(dashboard)/layout.tsx
 *
 * Dashboard shell — top-nav only layout.
 *
 * Structure:
 *   [Navbar — sticky top, full-width]
 *   [main  — centered container with spacious horizontal padding]
 *
 * The left sidebar has been removed in favour of a Vercel/GitHub-style
 * top-navigation paradigm. All role-based links live inside Navbar.tsx.
 *
 * Container strategy:
 *   container mx-auto px-6 md:px-12 lg:px-24 max-w-7xl
 *   → Keeps content readable at any viewport width.
 *   → Large horizontal padding prevents content from touching the screen edge.
 *   → max-w-7xl caps line length on ultra-wide monitors.
 */

"use client";

import Navbar from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { GraduationCap } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Client-side auth guard (belt-and-suspenders alongside middleware).
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login?next=/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  // Full-screen loading spinner while auth context hydrates.
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-slate-200" />
            <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-sky-500 border-t-transparent animate-spin" />
          </div>
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <GraduationCap size={16} className="text-sky-500" />
            Đang tải không gian học tập...
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ── Sticky top navigation ── */}
      <Navbar />

      {/* ── Main content — each page owns its own container/padding ── */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
