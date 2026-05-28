/**
 * lib/auth/check-ownership.ts
 *
 * Course ownership verification helper.
 *
 * A course is accessible (for write operations) by:
 *  - The TEACHER who created it (teacherId === caller.id)
 *  - Any ADMIN
 *
 * Usage in a route handler:
 *
 *   const caller = await getAuthUser(request);
 *   await verifyCourseOwner(caller, courseId);
 *   // ... proceed with write
 *
 * Throws `AuthError(403)` if the caller is neither the owner nor an ADMIN.
 * Throws `AuthError(404)` (surfaced as a message) if the course doesn't exist
 * — we use a normal Error here so the route handler maps it to 404.
 */

import prisma from "@/lib/prisma";
import { AuthError, type SafeUser } from "@/lib/auth/get-auth-user";
import { UserRole } from "@prisma/client";

/**
 * Verifies that `caller` may perform write operations on the given course.
 *
 * @param caller    - The authenticated user (from `getAuthUser`).
 * @param courseId  - The UUID of the target course.
 * @returns The course record (saves an extra DB round-trip in the caller).
 * @throws `Error`      if the course does not exist (map to 404 in handler).
 * @throws `AuthError`  (403) if the caller is neither owner nor ADMIN.
 */
export async function verifyCourseOwner(caller: SafeUser, courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    // Return just enough to check ownership + let the caller use the record.
    select: {
      id: true,
      title: true,
      description: true,
      thumbnailUrl: true,
      teacherId: true,
      aiEnabled: true,
      isPublished: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!course) {
    throw new Error(`Course with id "${courseId}" not found.`);
  }

  // ADMINs bypass ownership check.
  if (caller.role === UserRole.ADMIN) {
    return course;
  }

  // TEACHERs may only modify their own courses.
  if (course.teacherId !== caller.id) {
    throw new AuthError(
      "You do not have permission to modify this course.",
      403
    );
  }

  return course;
}
