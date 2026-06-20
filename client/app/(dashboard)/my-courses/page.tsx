import Link from "next/link";
import { BookMarked, PlusCircle } from "lucide-react";
import { UserRole } from "@prisma/client";
import CourseCard, {
  type CourseCardData,
  type CourseCardVariant,
} from "@/components/CourseCard";
import { Button } from "@/components/ui/button";
import { CoursePagination } from "@/components/courses/CoursePagination";
import { CourseSearchBar } from "@/components/courses/CourseSearchBar";
import { CourseStatusTabs } from "@/components/courses/CourseStatusTabs";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { getCourses } from "@/lib/services/course.service";
import { getMyEnrollments } from "@/lib/services/enrollment.service";

const PAGE_SIZE = 9;
const VALID_STATUSES = new Set(["ACTIVE", "COMPLETED", "DROPPED"]);

type EnrollmentStatusFilter = "ACTIVE" | "COMPLETED" | "DROPPED";
type SearchParams = Promise<{
  search?: string | string[];
  page?: string | string[];
  status?: string | string[];
}>;

function getParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function getPage(value: string | string[] | undefined) {
  const page = Number.parseInt(getParam(value), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function getStatus(value: string | string[] | undefined) {
  const status = getParam(value).toUpperCase();
  return VALID_STATUSES.has(status)
    ? (status as EnrollmentStatusFilter)
    : undefined;
}

function getPageMeta(role: UserRole) {
  if (role === UserRole.TEACHER) {
    return {
      title: "Khóa học của tôi",
      subtitle: "Quản lý các khóa học bạn đang giảng dạy.",
      emptyMessage: "Bạn chưa tạo khóa học nào.",
    };
  }

  if (role === UserRole.ADMIN) {
    return {
      title: "Tất cả khóa học",
      subtitle: "Quản lý toàn bộ khóa học trên hệ thống.",
      emptyMessage: "Chưa có khóa học nào trên hệ thống.",
    };
  }

  return {
    title: "Khóa học của tôi",
    subtitle: "Tiếp tục bài học đang dang dở.",
    emptyMessage: "Bạn chưa đăng ký khóa học nào.",
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const search = getParam(params.search).trim();
  const requestedPage = getPage(params.page);
  const status = getStatus(params.status);
  const user = await getAuthUser();
  const meta = getPageMeta(user.role);

  let courses: CourseCardData[];
  let variant: CourseCardVariant;
  let total: number;
  let pages: number;

  if (user.role === UserRole.STUDENT) {
    const result = await getMyEnrollments(user.id, status, {
      search: search || undefined,
      page: requestedPage,
      limit: PAGE_SIZE,
    });

    courses = result.items.map((enrollment) => ({
      id: enrollment.course.id,
      title: enrollment.course.title,
      description: enrollment.course.description,
      thumbnailUrl: enrollment.course.thumbnailUrl,
      teacher: enrollment.course.teacher,
      _count: enrollment.course._count,
      enrollmentStatus: enrollment.status,
      progress: enrollment.progress,
      nextLessonId: enrollment.nextLessonId,
    }));
    variant = "enrolled";
    total = result.total;
    pages = result.pages;
  } else {
    const result = await getCourses({
      search: search || undefined,
      page: requestedPage,
      limit: PAGE_SIZE,
      callerRole: user.role,
      callerId: user.id,
    });

    courses = result.items.map((course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      isPublished: course.isPublished,
      teacher: course.teacher,
      _count: course._count,
    }));
    variant = "manage";
    total = result.total;
    pages = result.pages;
  }

  const page = pages > 0 ? Math.min(requestedPage, pages) : 1;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 md:px-12 lg:px-24">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            {meta.title}
          </h1>
          <p className="mt-1 text-base text-slate-500">{meta.subtitle}</p>
        </div>
        {user.role !== UserRole.STUDENT && (
          <Link href="/courses/new">
            <Button className="gap-2 rounded-xl bg-sky-500 font-semibold text-white shadow-sm hover:bg-sky-600">
              <PlusCircle size={16} />
              Tạo khóa học
            </Button>
          </Link>
        )}
      </div>

      <CourseSearchBar
        id="my-courses-search"
        initialSearch={search}
        placeholder="Tìm khóa học theo tiêu đề..."
        className="mb-5"
      />

      {user.role === UserRole.STUDENT && (
        <div className="mb-6">
          <CourseStatusTabs status={status} />
        </div>
      )}

      <p className="mb-5 text-sm text-slate-500">
        {total === 0
          ? "Không tìm thấy khóa học."
          : `Tìm thấy ${total} khóa học`}
        {search && ` cho “${search}”`}
      </p>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center gap-5 py-24 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-sky-50">
            <BookMarked size={32} className="text-sky-300" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">
              {search
                ? `Không có khóa học nào khớp với “${search}”.`
                : meta.emptyMessage}
            </p>
            {!search && user.role === UserRole.STUDENT && (
              <p className="mt-1 text-sm text-slate-500">
                Duyệt danh mục và đăng ký một khóa học để bắt đầu.
              </p>
            )}
          </div>
          {!search && user.role === UserRole.STUDENT ? (
            <Link href="/courses">
              <Button className="rounded-xl bg-sky-500 text-white hover:bg-sky-600">
                Duyệt khóa học
              </Button>
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} variant={variant} />
          ))}
        </div>
      )}

      <CoursePagination page={page} pages={pages} />
    </div>
  );
}
