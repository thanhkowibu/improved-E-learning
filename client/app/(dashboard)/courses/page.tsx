import { BookOpen } from "lucide-react";
import CourseCard, { type CourseCardData } from "@/components/CourseCard";
import { CoursePagination } from "@/components/courses/CoursePagination";
import { CourseSearchBar } from "@/components/courses/CourseSearchBar";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { getCourses } from "@/lib/services/course.service";

const PAGE_SIZE = 9;

type SearchParams = Promise<{
  search?: string | string[];
  page?: string | string[];
}>;

function getParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function getPage(value: string | string[] | undefined) {
  const page = Number.parseInt(getParam(value), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const search = getParam(params.search).trim();
  const requestedPage = getPage(params.page);
  const user = await getAuthUser().catch(() => null);
  const result = await getCourses({
    search: search || undefined,
    page: requestedPage,
    limit: PAGE_SIZE,
    callerRole: user?.role,
    callerId: user?.id,
  });
  const page = result.pages > 0 ? Math.min(requestedPage, result.pages) : 1;
  const courses: CourseCardData[] = result.items.map((course) => ({
    id: course.id,
    title: course.title,
    description: course.description,
    thumbnailUrl: course.thumbnailUrl,
    isPublished: course.isPublished,
    teacher: course.teacher,
    _count: course._count,
  }));

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 md:px-12 lg:px-24">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Danh mục khóa học
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Khám phá các khóa học hiện có và bắt đầu học ngay hôm nay.
        </p>
      </div>

      <CourseSearchBar
        id="catalog-search"
        initialSearch={search}
        placeholder="Tìm khóa học theo tiêu đề..."
        className="mb-8"
      />

      <p className="mb-5 text-sm text-slate-500">
        {result.total === 0
          ? "Không tìm thấy khóa học."
          : `Tìm thấy ${result.total} khóa học`}
        {search && ` cho “${search}”`}
      </p>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-slate-100">
            <BookOpen size={32} className="text-slate-300" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">
              Không tìm thấy khóa học
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {search
                ? `Không có khóa học nào khớp với “${search}”.`
                : "Chưa có khóa học được xuất bản."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} variant="catalog" />
          ))}
        </div>
      )}

      <CoursePagination page={page} pages={result.pages} />
    </div>
  );
}
