"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Award,
  BookOpen,
  CalendarCheck2,
  GraduationCap,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface CompletedCourse {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  completedAt: string | null;
}

interface PublicProfile {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  highestEducation: string | null;
  bio: string | null;
  role: "ADMIN" | "TEACHER" | "STUDENT";
  completedCourses: CompletedCourse[];
}

function getAuthHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("lms_auth_token")
      : null;

  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function roleLabel(role: PublicProfile["role"]) {
  if (role === "TEACHER") return "Giảng viên";
  if (role === "ADMIN") return "Quản trị viên";
  return "Học viên";
}

function roleBadgeClass(role: PublicProfile["role"]) {
  if (role === "TEACHER")
    return "border-indigo-200 bg-indigo-50 text-indigo-700";
  if (role === "ADMIN") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function formatCompletionDate(value: string | null) {
  if (!value) return "Không rõ thời gian";
  return new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

async function parseApiResponse<T>(res: Response): Promise<{
  success: boolean;
  data?: T;
  message?: string;
}> {
  const text = await res.text();
  return text ? JSON.parse(text) : { success: res.ok };
}

function ProfileSkeleton() {
  return (
    <div className="container mx-auto max-w-7xl px-6 py-8 md:px-24">
      <div className="mb-10 space-y-3">
        <Skeleton className="h-9 w-56 rounded-lg" />
        <Skeleton className="h-5 w-full max-w-lg rounded-lg" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-2xl bg-slate-50/80 p-6">
          <div className="flex flex-col items-center">
            <Skeleton className="size-28 rounded-full" />
            <Skeleton className="mt-5 h-7 w-44 rounded-lg" />
            <Skeleton className="mt-3 h-6 w-28 rounded-full" />
          </div>
          <div className="mt-8 space-y-5 border-t border-slate-200 pt-6">
            <Skeleton className="h-5 w-full rounded-lg" />
            <Skeleton className="h-5 w-3/4 rounded-lg" />
            <Skeleton className="h-5 w-5/6 rounded-lg" />
          </div>
        </aside>
        <main className="space-y-8">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="border-t border-slate-200 pt-8">
            <Skeleton className="h-8 w-80 rounded-lg" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-44 rounded-2xl" />
              <Skeleton className="h-44 rounded-2xl" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function PublicProfilePage() {
  const params = useParams();
  const userId = params?.userId as string;
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const profileUrl = useMemo(
    () => (userId ? `/api/users/${userId}/public` : null),
    [userId],
  );

  useEffect(() => {
    if (!profileUrl) return;

    let isCancelled = false;

    async function loadProfile() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(profileUrl as string, {
          headers: getAuthHeaders(),
        });
        const json = await parseApiResponse<PublicProfile>(res);

        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.message ?? "Không thể tải hồ sơ công khai.");
        }

        if (!isCancelled) setProfile(json.data);
      } catch (err) {
        if (!isCancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Không thể tải hồ sơ công khai.",
          );
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    void loadProfile();

    return () => {
      isCancelled = true;
    };
  }, [profileUrl]);

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (error || !profile) {
    return (
      <div className="container mx-auto max-w-7xl px-6 py-16 md:px-24">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-50">
            <UserRound size={28} className="text-slate-300" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Không tìm thấy hồ sơ</p>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              {error ?? "Hồ sơ này không tồn tại hoặc hiện không khả dụng."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-6 py-8 md:px-24">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Hồ sơ cá nhân
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Thông tin công khai, học vấn và các chứng chỉ đã hoàn thành trên
          RakuLearn.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="self-start rounded-2xl bg-slate-50/90 p-6 ring-1 ring-slate-200/70">
          <div className="flex flex-col items-center text-center">
            <Avatar className="size-28 border-4 border-white shadow-sm">
              <AvatarImage src={profile.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-sky-100 text-3xl font-extrabold text-sky-700">
                {getInitials(profile.fullName)}
              </AvatarFallback>
            </Avatar>

            <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900">
              {profile.fullName}
            </h2>
            <Badge
              variant="outline"
              className={`mt-3 rounded-full px-3 py-1 font-semibold ${roleBadgeClass(
                profile.role,
              )}`}
            >
              {roleLabel(profile.role)}
            </Badge>
          </div>

          <div className="mt-8 space-y-5 border-t border-slate-200 pt-6">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                <GraduationCap size={16} />
                Học vấn
              </div>
              <p className="mt-2 text-sm font-medium text-slate-800">
                {profile.highestEducation ?? "Chưa cập nhật"}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                <ShieldCheck size={16} />
                Vai trò
              </div>
              <p className="mt-2 text-sm font-medium text-slate-800">
                {roleLabel(profile.role)}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                <Award size={16} />
                Chứng chỉ
              </div>
              <p className="mt-2 text-sm font-medium text-slate-800">
                {profile.completedCourses.length} khóa học đã hoàn thành
              </p>
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-8">
          <section className="rounded-2xl border-2 border-dashed border-slate-300 bg-white px-6 py-8 sm:px-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                <UserRound size={20} />
              </div>
              <div className="min-w-0">
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
                  Về tôi
                </h2>
                {profile.bio ? (
                  <p className="mt-4 whitespace-pre-line text-base leading-8 text-slate-700">
                    {profile.bio}
                  </p>
                ) : (
                  <p className="mt-4 text-base leading-8 text-slate-400">
                    Người dùng chưa cập nhật phần giới thiệu.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="border-t border-slate-200 pt-8">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Chứng chỉ & Khóa học đã hoàn thành
              </h2>
              <p className="mt-2 text-base text-slate-500">
                Các khóa học người dùng đã hoàn thành và có thể đưa vào hồ sơ
                học tập.
              </p>
            </div>

            {profile.completedCourses.length === 0 ? (
              <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-slate-50">
                  <Award size={32} className="text-slate-300" />
                </div>
                <p className="mt-5 text-lg font-extrabold text-slate-900">
                  Chưa có chứng chỉ nào.
                </p>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Khi người dùng hoàn thành khóa học, chứng chỉ sẽ được hiển thị
                  tại đây.
                </p>
              </div>
            ) : (
              <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {profile.completedCourses.map((course) => (
                  <article
                    key={course.id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {course.thumbnailUrl ? (
                      <img
                        src={course.thumbnailUrl}
                        alt={course.title}
                        className="aspect-video w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-video w-full items-center justify-center bg-sky-50">
                        <BookOpen size={30} className="text-sky-300" />
                      </div>
                    )}
                    <div className="space-y-3 p-4">
                      <h3 className="line-clamp-2 text-sm font-extrabold leading-6 text-slate-900">
                        {course.title}
                      </h3>
                      <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                        <CalendarCheck2 size={14} />
                        Hoàn thành vào:{" "}
                        {formatCompletionDate(course.completedAt)}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
