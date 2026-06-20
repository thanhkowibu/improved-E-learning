/**
 * lib/services/enrollment.service.ts
 *
 * All database operations for the Enrollment model.
 *
 * Key behaviours:
 *  - enrollStudent: handles Prisma P2002 (unique constraint violation) to give
 *    a clean error message when a student tries to re-enroll.
 *    If a DROPPED enrollment already exists, it is reactivated instead of
 *    creating a duplicate (upsert pattern).
 *  - dropEnrollment: soft-delete by setting status → DROPPED.
 *  - getMyEnrollments: returns the student's enrollments with full course
 *    and teacher summary (for the "My Courses" dashboard).
 *  - getCourseStudents: returns active students for a course (teacher/admin).
 */

import prisma from "@/lib/prisma";
import { EnrollmentStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  getCompletedLessonIds,
  getCourseProgressPercentage,
} from "@/lib/services/progress.service";

/**
 * Keeps the persisted enrollment status aligned with lesson completion.
 * DROPPED is an explicit user action and must never be overwritten by progress.
 */
export async function synchronizeEnrollmentCompletionStatus(
  studentId: string,
  courseId: string,
): Promise<EnrollmentStatus | null> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
    select: { status: true },
  });

  if (!enrollment || enrollment.status === EnrollmentStatus.DROPPED) {
    return enrollment?.status ?? null;
  }

  const [totalLessons, completedLessons] = await Promise.all([
    prisma.lesson.count({
      where: { module: { courseId } },
    }),
    prisma.lessonProgress.count({
      where: {
        studentId,
        isCompleted: true,
        lesson: { module: { courseId } },
      },
    }),
  ]);

  const nextStatus =
    totalLessons > 0 && completedLessons >= totalLessons
      ? EnrollmentStatus.COMPLETED
      : EnrollmentStatus.ACTIVE;

  if (enrollment.status !== nextStatus) {
    await prisma.enrollment.update({
      where: { studentId_courseId: { studentId, courseId } },
      data: { status: nextStatus },
    });
  }

  return nextStatus;
}

async function reconcileEnrollmentCompletionStatuses(studentId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      studentId,
      status: { not: EnrollmentStatus.DROPPED },
    },
    select: { courseId: true },
  });

  await Promise.all(
    enrollments.map((enrollment) =>
      synchronizeEnrollmentCompletionStatus(studentId, enrollment.courseId),
    ),
  );
}

// ─── enrollStudent ────────────────────────────────────────────────────────────

/**
 * Enrolls a student in a course, or reactivates a previously DROPPED
 * enrollment via upsert.
 *
 * @throws Error "already enrolled" if the student is currently ACTIVE.
 * @throws Error "not found" if the course does not exist.
 */
export async function enrollStudent(studentId: string, courseId: string) {
  // Confirm the course exists and is published before enrolling.
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, isPublished: true, isPrivate: true },
  });

  if (!course) {
    throw new Error(`Khóa học "${courseId}" không tồn tại.`);
  }

  if (!course.isPublished) {
    throw new Error("Bạn không thể tham gia khóa học chưa xuất bản.");
  }

  if (course.isPrivate) {
    throw new Error("Khóa học nội bộ chỉ cho phép giảng viên thêm sinh viên.");
  }

  // Check for an existing enrollment (any status).
  const existing = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
    select: { status: true },
  });

  if (existing?.status === EnrollmentStatus.ACTIVE) {
    throw new Error("Bạn đã ở trong khóa học rồi.");
  }

  // Upsert: create new or reactivate a DROPPED enrollment.
  return prisma.enrollment.upsert({
    where: { studentId_courseId: { studentId, courseId } },
    create: { studentId, courseId, status: EnrollmentStatus.ACTIVE },
    update: { status: EnrollmentStatus.ACTIVE },
    include: {
      course: {
        select: { id: true, title: true, thumbnailUrl: true },
      },
    },
  });
}

// ─── dropEnrollment ───────────────────────────────────────────────────────────

/**
 * Soft-removes an enrollment by setting status to DROPPED.
 *
 * @throws Error if no ACTIVE enrollment exists for this student+course pair.
 */
export async function dropEnrollment(studentId: string, courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, isPrivate: true },
  });

  if (!course) {
    throw new Error(`Course with id "${courseId}" not found.`);
  }

  if (course.isPrivate) {
    throw new Error("Không thể hủy đăng ký khóa học nội bộ.");
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
    select: { status: true },
  });

  if (!enrollment) {
    throw new Error("Bạn chưa tham gia khóa học này.");
  }

  if (enrollment.status === EnrollmentStatus.DROPPED) {
    throw new Error("Bạn đã hủy tham gia khóa học rồi.");
  }

  return prisma.enrollment.update({
    where: { studentId_courseId: { studentId, courseId } },
    data: { status: EnrollmentStatus.DROPPED },
  });
}

// ─── getMyEnrollments ─────────────────────────────────────────────────────────

/**
 * Returns all enrollments for a student, ordered by most recent first.
 * Includes course details and teacher summary for the "My Courses" page.
 */
export async function getMyEnrollments(
  studentId: string,
  statusFilter?: EnrollmentStatus,
  options: {
    search?: string;
    page?: number;
    limit?: number;
  } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));
  const skip = (page - 1) * limit;
  const search = options.search?.trim();

  // Backfill historical ACTIVE records that reached 100% before completion
  // status synchronization was introduced. This runs before filtering so the
  // COMPLETED tab is accurate immediately.
  await reconcileEnrollmentCompletionStatuses(studentId);

  const where: Prisma.EnrollmentWhereInput = {
    studentId,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(search
      ? {
          course: {
            title: {
              contains: search,
              mode: "insensitive",
            },
          },
        }
      : {}),
  };

  const [enrollments, total] = await prisma.$transaction([
    prisma.enrollment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { enrolledAt: "desc" },
      include: {
        course: {
          include: {
            teacher: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
              },
            },
            modules: {
              orderBy: { orderIndex: "asc" },
              select: {
                lessons: {
                  orderBy: { orderIndex: "asc" },
                  select: {
                    id: true,
                  },
                },
              },
            },
            _count: {
              select: { modules: true, enrollments: true },
            },
          },
        },
      },
    }),
    prisma.enrollment.count({ where }),
  ]);

  const items = await Promise.all(
    enrollments.map(async (e) => {
      const [progress, completedLessonIds] = await Promise.all([
        getCourseProgressPercentage(studentId, e.courseId),
        getCompletedLessonIds(studentId, e.courseId),
      ]);
      const completedLessonIdSet = new Set(completedLessonIds);

      // Find the next incomplete lesson in curriculum order.
      let nextLessonId: string | null = null;
      for (const m of e.course.modules) {
        for (const l of m.lessons) {
          if (!completedLessonIdSet.has(l.id)) {
            nextLessonId = l.id;
            break;
          }
        }
        if (nextLessonId) break;
      }

      return {
        id: e.id,
        studentId: e.studentId,
        courseId: e.courseId,
        status: e.status,
        enrolledAt: e.enrolledAt,
        progress,
        nextLessonId,
        course: {
          id: e.course.id,
          title: e.course.title,
          description: e.course.description,
          thumbnailUrl: e.course.thumbnailUrl,
          teacherId: e.course.teacherId,
          aiEnabled: e.course.aiEnabled,
          isPublished: e.course.isPublished,
          createdAt: e.course.createdAt,
          updatedAt: e.course.updatedAt,
          teacher: e.course.teacher,
          _count: e.course._count,
        },
      };
    }),
  );

  return {
    items,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

// ─── getCourseStudents ────────────────────────────────────────────────────────

/**
 * Returns a paginated list of students enrolled in a course.
 * Optionally filtered by status (defaults to ACTIVE).
 */
export async function getCourseStudents(
  courseId: string,
  options: {
    status?: EnrollmentStatus;
    page?: number;
    limit?: number;
  } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));
  const skip = (page - 1) * limit;
  const status = options.status ?? EnrollmentStatus.ACTIVE;

  const [enrollments, total] = await prisma.$transaction([
    prisma.enrollment.findMany({
      where: { courseId, status },
      skip,
      take: limit,
      orderBy: { enrolledAt: "desc" },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.enrollment.count({ where: { courseId, status } }),
  ]);

  return {
    items: enrollments,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}
