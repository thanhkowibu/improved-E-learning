"use client";

/**
 * app/page.tsx  →  /
 *
 * Public landing page — redirects authenticated users to /dashboard,
 * shows a marketing hero + published courses for guests.
 *
 * Previously used an old axios `api` client with a different response shape.
 * Now uses the standard useApi hook that matches our { success, data } envelope.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { useRouter } from "next/navigation";
import { BookOpen, GraduationCap, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";

interface Course {
  id: string;
  title: string;
  description: string | null;
  teacher?: { fullName: string };
}

export default function Home() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const api = useApi();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // Redirect authenticated users straight to the dashboard
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    api
      .get<{ items: Course[] }>("/api/courses?limit=6")
      .then((res) => {
        if (res.success && res.data) {
          setCourses(res.data.items ?? []);
        }
      })
      .catch(() => {/* silently ignore on landing page */})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-sky-600 via-sky-500 to-sky-400 text-white">
        <div className="mx-auto px-6 md:px-12 lg:px-24 max-w-7xl py-24 md:py-32">
          <div className="max-w-2xl">
            <p className="text-sky-100 text-sm font-semibold uppercase tracking-widest mb-3">
              The Academic LMS
            </p>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
              Enlightening Your<br />Digital Future
            </h1>
            <p className="mt-5 text-sky-100 text-lg leading-relaxed max-w-xl">
              Access 100+ high-quality courses across technology, design, and sciences.
              Learn at your own pace with industry-leading instructors.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-sky-600 font-semibold rounded-xl hover:bg-sky-50 transition-colors shadow-sm"
              >
                Get Started — It&apos;s Free
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/courses"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/15 text-white font-semibold rounded-xl hover:bg-white/25 transition-colors border border-white/30"
              >
                <BookOpen size={16} />
                Browse Courses
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured courses */}
      <section className="mx-auto px-6 md:px-12 lg:px-24 max-w-7xl py-16">
        <h2 className="text-2xl font-bold text-slate-900 mb-8">Featured Courses</h2>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="p-8 bg-sky-50 text-sky-700 rounded-2xl border border-sky-200 text-center">
            <GraduationCap size={32} className="mx-auto mb-3 text-sky-400" />
            <p className="font-semibold">No courses published yet.</p>
            <p className="text-sm text-sky-500 mt-1">Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <Link
                key={course.id}
                href={`/courses/${course.id}`}
                className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="h-10 w-10 rounded-xl bg-sky-50 flex items-center justify-center mb-3">
                  <BookOpen size={18} className="text-sky-500" />
                </div>
                <h3 className="font-bold text-slate-900 text-base group-hover:text-sky-600 transition-colors line-clamp-2">
                  {course.title}
                </h3>
                {course.description && (
                  <p className="mt-1.5 text-sm text-slate-500 line-clamp-2">{course.description}</p>
                )}
                {course.teacher && (
                  <p className="mt-3 text-xs text-slate-400 flex items-center gap-1">
                    <GraduationCap size={11} /> {course.teacher.fullName}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-10 text-center">
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 px-6 py-3 bg-sky-500 text-white font-semibold rounded-xl hover:bg-sky-600 transition-colors shadow-sm"
          >
            View All Courses <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </>
  );
}
