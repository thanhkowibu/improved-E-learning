/**
 * app/api/courses/[courseId]/setup-ai/route.ts
 *
 * POST /api/courses/:courseId/setup-ai
 *   Uploads all eligible course materials to Gemini File API and enables the
 *   course AI Tutor after every unsynced file is ACTIVE.
 *
 * Access: Course owner (TEACHER) or ADMIN
 */

import path from "path";
import { type NextRequest } from "next/server";
import { MaterialType, UserRole } from "@prisma/client";

import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { requireRole } from "@/lib/auth/require-role";
import { verifyCourseOwner } from "@/lib/auth/check-ownership";
import prisma from "@/lib/prisma";
import { geminiService } from "@/lib/gemini/gemini.service";
import { resolveFilePath } from "@/lib/services/storage.service";
import {
  ok,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api-response";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ courseId: string }> };

function isEligibleGeminiMaterial(material: {
  materialType: MaterialType;
  fileUrl: string;
}): boolean {
  const extension = path.extname(material.fileUrl).toLowerCase();

  return (
    material.materialType === MaterialType.PDF ||
    extension === ".txt" ||
    extension === ".text" ||
    extension === ".md" ||
    extension === ".docx" ||
    extension === ".doc" ||
    extension === ".csv" ||
    extension === ".xlsx" ||
    extension === ".pptx"
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { courseId } = await context.params;
    const caller = await getAuthUser(request);

    requireRole(caller, [UserRole.TEACHER, UserRole.ADMIN]);
    await verifyCourseOwner(caller, courseId);

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          include: {
            lessons: {
              include: {
                materials: true,
              },
            },
          },
        },
      },
    });

    if (!course) {
      return notFound(`Course with id "${courseId}" not found.`);
    }

    const materials = course.modules
      .flatMap((module) => module.lessons)
      .flatMap((lesson) => lesson.materials)
      .filter(isEligibleGeminiMaterial);

    let uploadedCount = 0;

    for (const material of materials) {
      if (material.geminiFileUri) {
        continue;
      }

      const filePath = resolveFilePath(material.fileUrl);
      const uploadedFile = await geminiService.uploadFileToGemini(
        filePath,
        material.title,
      );

      if (!uploadedFile.name) {
        throw new Error(
          `Gemini upload for material "${material.id}" did not return a file name.`,
        );
      }

      const activeFile = await geminiService.waitForFileActive(
        uploadedFile.name,
      );

      if (!activeFile.uri) {
        throw new Error(
          `Gemini file "${activeFile.name ?? uploadedFile.name}" became ACTIVE but did not return a URI.`,
        );
      }

      await prisma.material.update({
        where: { id: material.id },
        data: {
          geminiFileUri: activeFile.uri,
          geminiFileName: activeFile.name ?? uploadedFile.name,
        },
      });

      uploadedCount += 1;
    }

    const updatedCourse = await prisma.course.update({
      where: { id: courseId },
      data: { aiEnabled: true },
      select: {
        id: true,
        aiEnabled: true,
      },
    });

    return ok(
      {
        courseId: updatedCourse.id,
        aiEnabled: updatedCourse.aiEnabled,
        filesSynced: uploadedCount,
        eligibleMaterialCount: materials.length,
      },
      `AI Tutor enabled. ${uploadedCount} new file(s) uploaded to Gemini.`,
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

    console.error("[POST /api/courses/:courseId/setup-ai]", err);
    return serverError(
      err instanceof Error ? err.message : "Failed to set up AI Tutor.",
    );
  }
}
