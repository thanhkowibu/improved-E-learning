import prisma from "@/lib/prisma";

export async function toggleLessonBookmark(userId: string, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true },
  });

  if (!lesson) {
    throw new Error("Lesson not found.");
  }

  const existing = await prisma.bookmark.findUnique({
    where: {
      userId_lessonId: {
        userId,
        lessonId,
      },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.bookmark.delete({
      where: { id: existing.id },
    });

    return { bookmarked: false };
  }

  await prisma.bookmark.create({
    data: {
      userId,
      lessonId,
    },
  });

  return { bookmarked: true };
}

export async function getCourseBookmarks(userId: string, courseId: string) {
  return prisma.bookmark.findMany({
    where: {
      userId,
      lesson: {
        module: {
          courseId,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      lesson: {
        select: {
          id: true,
          title: true,
          orderIndex: true,
          module: {
            select: {
              id: true,
              title: true,
              orderIndex: true,
            },
          },
        },
      },
    },
  });
}
