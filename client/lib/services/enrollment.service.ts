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
    select: { id: true, isPublished: true },
  });

  if (!course) {
    throw new Error(`Course with id "${courseId}" not found.`);
  }

  if (!course.isPublished) {
    throw new Error("You cannot enroll in a course that is not yet published.");
  }

  // Check for an existing enrollment (any status).
  const existing = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
    select: { status: true },
  });

  if (existing?.status === EnrollmentStatus.ACTIVE) {
    throw new Error("You are already enrolled in this course.");
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
  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
    select: { status: true },
  });

  if (!enrollment) {
    throw new Error("You are not enrolled in this course.");
  }

  if (enrollment.status === EnrollmentStatus.DROPPED) {
    throw new Error("You have already dropped this course.");
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
  statusFilter?: EnrollmentStatus
) {
  const where: Prisma.EnrollmentWhereInput = { studentId };
  if (statusFilter) {
    where.status = statusFilter;
  }

  return prisma.enrollment.findMany({
    where,
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
          _count: {
            select: { modules: true, enrollments: true },
          },
        },
      },
    },
  });
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
  } = {}
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
