/**
 * lib/auth/check-enrollment.ts
 *
 * Enrollment access helper — used to gate access to lesson content,
 * materials, and AI chat for students.
 *
 * Access hierarchy for a given courseId:
 *   ADMIN   → always allowed (platform-wide access)
 *   TEACHER → allowed if they own the course (teacherId === caller.id)
 *   STUDENT → allowed if they have an ACTIVE enrollment in the course
 *   Others  → denied
 *
 * Usage pattern in route handlers:
 *
 *   const caller = await getAuthUser(request);
 *   const allowed = await verifyEnrollment(caller, courseId);
 *   if (!allowed) return forbidden("You are not enrolled in this course.");
 *
 * Unlike verifyCourseOwner (which throws), this helper returns a boolean
 * so callers can decide how to respond — useful for conditional logic
 * (e.g. returning full content vs. preview content).
 */

import prisma from "@/lib/prisma";
import { UserRole, EnrollmentStatus } from "@prisma/client";
import type { SafeUser } from "@/lib/auth/get-auth-user";

/**
 * Returns `true` if the caller is allowed to access content within the
 * given course, `false` otherwise.
 *
 * Does NOT throw. The caller decides the appropriate HTTP response.
 *
 * @param caller    - The authenticated user from `getAuthUser`.
 * @param courseId  - The course to check access for.
 */
export async function verifyEnrollment(
  caller: SafeUser,
  courseId: string
): Promise<boolean> {
  // ADMINs have unrestricted access.
  if (caller.role === UserRole.ADMIN) return true;

  // TEACHERs can access their own courses (published + unpublished).
  if (caller.role === UserRole.TEACHER) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { teacherId: true },
    });
    return course?.teacherId === caller.id;
  }

  // STUDENTs must have an ACTIVE enrollment.
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      // Uses the @@unique([studentId, courseId]) composite index from schema.
      studentId_courseId: { studentId: caller.id, courseId },
    },
    select: { status: true },
  });

  return enrollment?.status === EnrollmentStatus.ACTIVE;
}
