/**
 * lib/services/user.service.ts
 *
 * All database operations related to the User model.
 * Route handlers MUST NOT call prisma directly — they go through this service.
 *
 * Conventions:
 *  - hashedPassword is ALWAYS excluded from returned objects.
 *  - Throws plain `Error` instances with meaningful messages.
 *    Route handlers are responsible for mapping these to HTTP responses.
 *  - Pagination uses cursor-free offset (page + limit) — simple and sufficient
 *    for admin user lists. Max limit is capped at 100.
 */

import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Fields to always exclude from user responses. */
const EXCLUDE_PASSWORD = { hashedPassword: true } as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ─── getUserById ──────────────────────────────────────────────────────────────

/**
 * Fetch a single user by their UUID.
 * @throws Error if the user is not found.
 */
export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    omit: EXCLUDE_PASSWORD,
  });

  if (!user) {
    throw new Error(`User with id "${userId}" not found.`);
  }

  return user;
}

export async function getUserWithPasswordById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      hashedPassword: true,
    },
  });

  if (!user) {
    throw new Error(`User with id "${userId}" not found.`);
  }

  return user;
}

// ─── getAllUsers ──────────────────────────────────────────────────────────────

/**
 * Paginated list of all platform users (ADMIN dashboard).
 * Ordered by creation date descending (newest first).
 */
export async function getAllUsers(
  params: PaginationParams = {}
): Promise<PaginatedResult<Awaited<ReturnType<typeof getUserById>>>> {
  const page = Math.max(1, params.page ?? DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? DEFAULT_LIMIT));
  const skip = (page - 1) * limit;

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      omit: EXCLUDE_PASSWORD,
    }),
    prisma.user.count(),
  ]);

  return {
    items: users,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

// ─── updateUser ───────────────────────────────────────────────────────────────

/**
 * Partial update of a user record.
 * Only fields present in the payload are updated (PATCH semantics).
 * Validation of which fields are allowed happens in the route handler.
 *
 * @throws Error if the user is not found.
 */
export async function updateUser(
  userId: string,
  data: Prisma.UserUpdateInput
) {
  // Guard: ensure the user exists first for a clear error message.
  const exists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!exists) {
    throw new Error(`User with id "${userId}" not found.`);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    omit: EXCLUDE_PASSWORD,
  });

  return updated;
}

export async function updateUserPassword(userId: string, hashedPassword: string) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { hashedPassword },
    omit: EXCLUDE_PASSWORD,
  });

  return updated;
}

export async function getPublicUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      avatarUrl: true,
      highestEducation: true,
      bio: true,
      role: true,
    },
  });

  if (!user) {
    throw new Error(`User with id "${userId}" not found.`);
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      studentId: userId,
      status: { not: "DROPPED" },
    },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          thumbnailUrl: true,
          modules: {
            select: {
              lessons: {
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });

  const lessonIds = enrollments.flatMap((enrollment) =>
    enrollment.course.modules.flatMap((module) =>
      module.lessons.map((lesson) => lesson.id),
    ),
  );

  const progress = lessonIds.length
    ? await prisma.lessonProgress.findMany({
        where: {
          studentId: userId,
          lessonId: { in: lessonIds },
          isCompleted: true,
        },
        select: {
          lessonId: true,
          updatedAt: true,
        },
      })
    : [];

  const completedProgressByLessonId = new Map(
    progress.map((item) => [item.lessonId, item.updatedAt]),
  );

  const completedCourses = enrollments
    .map((enrollment) => {
      const courseLessonIds = enrollment.course.modules.flatMap((module) =>
        module.lessons.map((lesson) => lesson.id),
      );

      const isCompletedByProgress =
        courseLessonIds.length > 0 &&
        courseLessonIds.every((lessonId) =>
          completedProgressByLessonId.has(lessonId),
        );

      const isCompleted =
        enrollment.status === "COMPLETED" || isCompletedByProgress;

      if (!isCompleted) return null;

      const completedAt =
        courseLessonIds
          .map((lessonId) => completedProgressByLessonId.get(lessonId))
          .filter((date): date is Date => Boolean(date))
          .sort((a, b) => b.getTime() - a.getTime())[0] ??
        enrollment.enrolledAt;

      return {
        id: enrollment.course.id,
        title: enrollment.course.title,
        thumbnailUrl: enrollment.course.thumbnailUrl,
        completedAt,
      };
    })
    .filter(
      (course): course is {
        id: string;
        title: string;
        thumbnailUrl: string | null;
        completedAt: Date;
      } => course !== null,
    );

  return {
    ...user,
    completedCourses,
  };
}

// ─── deactivateUser ───────────────────────────────────────────────────────────

/**
 * Soft-delete a user by setting isActive = false.
 * Returns the updated user so the caller can confirm the new state.
 *
 * @throws Error if the user is not found.
 */
export async function deactivateUser(userId: string) {
  const exists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!exists) {
    throw new Error(`User with id "${userId}" not found.`);
  }

  const deactivated = await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
    omit: EXCLUDE_PASSWORD,
  });

  return deactivated;
}
