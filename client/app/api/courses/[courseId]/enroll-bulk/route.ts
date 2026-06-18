/**
 * app/api/courses/[courseId]/enroll-bulk/route.ts
 *
 * POST /api/courses/:courseId/enroll-bulk
 *   Bulk-add students to a course by email.
 *
 * DELETE /api/courses/:courseId/enroll-bulk
 *   Bulk-remove selected students from a course.
 *
 * Access: Course owner (TEACHER) or ADMIN.
 */

import { type NextRequest } from "next/server";
import { EnrollmentStatus, UserRole } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { verifyCourseOwner } from "@/lib/auth/check-ownership";
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api-response";

type RouteContext = { params: Promise<{ courseId: string }> };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmails(input: unknown) {
  const raw =
    typeof input === "string"
      ? input.split(/[,\n\r;]+/)
      : Array.isArray(input)
        ? input
        : [];

  return Array.from(
    new Set(
      raw
        .filter((value): value is string => typeof value === "string")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
        .filter((email) => EMAIL_PATTERN.test(email)),
    ),
  );
}

function normalizeUserIds(input: unknown) {
  if (!Array.isArray(input)) return [];

  return Array.from(
    new Set(
      input
        .filter((value): value is string => typeof value === "string")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { courseId } = await context.params;
    const caller = await getAuthUser(request);

    await verifyCourseOwner(caller, courseId);

    const body = (await request.json()) as { emails?: unknown };
    const emails = normalizeEmails(body.emails);

    if (emails.length === 0) {
      return badRequest(
        "Không tìm thấy email hợp lệ. Vui lòng chọn sinh viên hoặc nhập email đúng định dạng.",
      );
    }

    const students = await prisma.user.findMany({
      where: {
        email: { in: emails },
        role: UserRole.STUDENT,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
      },
    });

    if (students.length === 0) {
      return ok(
        {
          addedCount: 0,
          matchedCount: 0,
          skippedCount: emails.length,
        },
        "Không tìm thấy tài khoản sinh viên phù hợp.",
      );
    }

    const existingEnrollments = await prisma.enrollment.findMany({
      where: {
        courseId,
        studentId: { in: students.map((student) => student.id) },
      },
      select: {
        studentId: true,
      },
    });
    const existingStudentIds = new Set(
      existingEnrollments.map((enrollment) => enrollment.studentId),
    );

    const newStudents = students.filter(
      (student) => !existingStudentIds.has(student.id),
    );

    if (newStudents.length > 0) {
      await prisma.enrollment.createMany({
        data: newStudents.map((student) => ({
          studentId: student.id,
          courseId,
          status: EnrollmentStatus.ACTIVE,
        })),
      });
    }

    return ok(
      {
        addedCount: newStudents.length,
        matchedCount: students.length,
        skippedCount: emails.length - newStudents.length,
      },
      `Đã thêm ${newStudents.length} sinh viên vào khóa học.`,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403
        ? forbidden(err.message)
        : unauthorized(err.message);
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[POST /api/courses/:courseId/enroll-bulk]", err);
    return serverError();
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { courseId } = await context.params;
    const caller = await getAuthUser(request);

    await verifyCourseOwner(caller, courseId);

    const body = (await request.json()) as { userIds?: unknown };
    const userIds = normalizeUserIds(body.userIds);

    if (userIds.length === 0) {
      return badRequest("Vui lòng chọn ít nhất một sinh viên để xóa.");
    }

    const result = await prisma.enrollment.deleteMany({
      where: {
        courseId,
        studentId: { in: userIds },
      },
    });

    return ok(
      { deletedCount: result.count },
      `Đã xóa ${result.count} sinh viên khỏi khóa học.`,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403
        ? forbidden(err.message)
        : unauthorized(err.message);
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[DELETE /api/courses/:courseId/enroll-bulk]", err);
    return serverError();
  }
}
