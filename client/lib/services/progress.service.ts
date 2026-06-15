import prisma from "@/lib/prisma";

/**
 * Returns the completed lesson IDs for one user within one course.
 *
 * The current schema does not have a per-lesson publication flag, so course
 * progress is based on all lessons attached to the course modules.
 */
export async function getCompletedLessonIds(
  userId: string,
  courseId: string,
): Promise<string[]> {
  const progressRecords = await prisma.lessonProgress.findMany({
    where: {
      studentId: userId,
      isCompleted: true,
      lesson: {
        module: {
          courseId,
        },
      },
    },
    select: {
      lessonId: true,
    },
  });

  return progressRecords.map((record) => record.lessonId);
}

/**
 * Calculates a student's course completion percentage.
 *
 * Returns 0 when the course has no lessons.
 */
export async function getCourseProgressPercentage(
  userId: string,
  courseId: string,
): Promise<number> {
  const [totalLessons, completedLessonIds] = await Promise.all([
    prisma.lesson.count({
      where: {
        module: {
          courseId,
        },
      },
    }),
    getCompletedLessonIds(userId, courseId),
  ]);

  if (totalLessons === 0) return 0;

  return Math.round((completedLessonIds.length / totalLessons) * 100);
}
