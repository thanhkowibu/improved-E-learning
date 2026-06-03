import { getAuthUser } from "@/lib/auth/get-auth-user";
import prisma from "@/lib/prisma";
import AnalyticsChart from "@/components/analytics/AnalyticsChart";
import { redirect } from "next/navigation";

export default async function AnalyticsPage() {
  let user;
  try {
    user = await getAuthUser();
  } catch {
    redirect("/login");
  }

  // Admin/Teacher Logic
  if (user.role === "ADMIN" || user.role === "TEACHER") {
    const whereClause = user.role === "TEACHER" ? { teacherId: user.id } : {};
    const courses = await prisma.course.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { enrollments: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const chartData = courses.map((course) => ({
      name: course.title,
      enrollments: course._count.enrollments,
    }));

    return (
      <div className="mx-auto px-6 md:px-12 lg:px-24 max-w-7xl py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Analytics
          </h1>
          <p className="text-slate-500 text-sm">
            Platform statistics and insights
          </p>
        </div>
        <AnalyticsChart data={chartData} role={user.role} />
      </div>
    );
  }

  // Student Logic
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: user.id },
    include: {
      course: {
        include: {
          modules: {
            include: {
              lessons: true,
            },
          },
        },
      },
    },
  });

  const progressRecords = await prisma.lessonProgress.findMany({
    where: { studentId: user.id, isCompleted: true },
  });
  const completedLessonIds = new Set(progressRecords.map((p) => p.lessonId));

  const chartData = enrollments.map((enrollment) => {
    let totalLessons = 0;
    let completedLessons = 0;

    enrollment.course.modules.forEach((module) => {
      module.lessons.forEach((lesson) => {
        totalLessons++;
        if (completedLessonIds.has(lesson.id)) {
          completedLessons++;
        }
      });
    });

    const calculatedPercentage =
      totalLessons === 0
        ? 0
        : Math.round((completedLessons / totalLessons) * 100);

    return {
      name: enrollment.course.title,
      progress: calculatedPercentage,
    };
  });

  return (
    <div className="mx-auto px-6 md:px-12 lg:px-24 max-w-7xl py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Analytics
        </h1>
        <p className="text-slate-500 text-sm">Your learning progress</p>
      </div>
      <AnalyticsChart data={chartData} role={user.role} />
    </div>
  );
}
