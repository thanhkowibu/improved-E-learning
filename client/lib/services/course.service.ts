/**
 * lib/services/course.service.ts
 *
 * All database operations for the Course model.
 *
 * Role-based visibility rules (enforced in getCourses):
 *  - STUDENT / unauthenticated → published courses only
 *  - TEACHER                   → own courses (published + unpublished)
 *  - ADMIN                     → all courses
 *
 * getCourseById fetches the full nested tree:
 *   Course → modules (ordered) → lessons (ordered)
 * This is used for the course detail page and the teacher editor.
 */

import prisma from "@/lib/prisma";
import type { CourseCreateInput, CourseUpdateInput } from "@/lib/validations/course";
import { UserRole, Prisma } from "@prisma/client";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CourseListParams {
  page?: number;
  limit?: number;
  search?: string;
  /** Caller role — drives visibility filter. */
  callerRole?: UserRole | null;
  /** Caller ID — used to scope TEACHER queries to own courses. */
  callerId?: string | null;
}

// ─── createCourse ─────────────────────────────────────────────────────────────

/**
 * Creates a new course owned by `teacherId`.
 */
export async function createCourse(
  data: CourseCreateInput,
  teacherId: string
) {
  return prisma.course.create({
    data: {
      ...data,
      teacherId,
    },
    include: {
      teacher: {
        omit: { hashedPassword: true },
      },
    },
  });
}

// ─── getCourses ───────────────────────────────────────────────────────────────

/**
 * Returns a paginated list of courses filtered by the caller's role.
 * Optionally searches by title (case-insensitive substring).
 */
export async function getCourses(params: CourseListParams = {}) {
  const page = Math.max(1, params.page ?? DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? DEFAULT_LIMIT));
  const skip = (page - 1) * limit;

  // Build the `where` clause based on role.
  let where: Prisma.CourseWhereInput = {};

  if (params.callerRole === UserRole.ADMIN) {
    // ADMIN sees everything.
    where = {};
  } else if (params.callerRole === UserRole.TEACHER && params.callerId) {
    // TEACHER sees only their own courses (published + unpublished).
    where = { teacherId: params.callerId };
  } else {
    // STUDENT / public — published only.
    where = { isPublished: true };
  }

  // Optional title search (applied on top of role filter).
  if (params.search) {
    where = {
      ...where,
      title: { contains: params.search, mode: "insensitive" },
    };
  }

  const [courses, total] = await prisma.$transaction([
    prisma.course.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        teacher: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: { enrollments: true, modules: true },
        },
      },
    }),
    prisma.course.count({ where }),
  ]);

  return {
    items: courses,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

// ─── getCourseById ────────────────────────────────────────────────────────────

/**
 * Returns the full course detail including the nested module → lesson tree.
 * Modules and lessons are ordered by `orderIndex` ascending.
 *
 * @throws Error if the course is not found.
 */
export async function getCourseById(courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
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
        include: {
          lessons: {
            orderBy: { orderIndex: "asc" },
            select: {
              id: true,
              title: true,
              orderIndex: true,
              createdAt: true,
              updatedAt: true,
              // Deliberately exclude `content` from the list view
              // (heavy field — loaded separately on lesson detail).
              _count: { select: { materials: true } },
            },
          },
        },
      },
      _count: {
        select: { enrollments: true },
      },
    },
  });

  if (!course) {
    throw new Error(`Course with id "${courseId}" not found.`);
  }

  return course;
}

// ─── updateCourse ─────────────────────────────────────────────────────────────

/**
 * Partial update of a course. Only present fields are changed.
 * Ownership/auth check must be performed BEFORE calling this function.
 *
 * @throws Error if the course is not found.
 */
export async function updateCourse(courseId: string, data: CourseUpdateInput) {
  // Existence is already guaranteed by verifyCourseOwner in the route handler,
  // but we guard here too for safety when called from other contexts.
  const updated = await prisma.course.update({
    where: { id: courseId },
    data,
    include: {
      teacher: {
        select: { id: true, fullName: true, avatarUrl: true },
      },
    },
  });

  return updated;
}

// ─── deleteCourse ─────────────────────────────────────────────────────────────

/**
 * Hard-deletes a course.
 * Prisma cascade rules in schema.prisma handle deletion of nested
 * modules, lessons, materials, enrollments, and chat threads automatically.
 *
 * @throws Error if the course is not found.
 */
export async function deleteCourse(courseId: string) {
  return prisma.course.delete({
    where: { id: courseId },
  });
}
