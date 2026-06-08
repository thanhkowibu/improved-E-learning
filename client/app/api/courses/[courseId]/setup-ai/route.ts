/**
 * app/api/courses/[courseId]/setup-ai/route.ts
 *
 * POST /api/courses/:courseId/setup-ai
 *   Uploads all eligible course materials to Gemini File API and enables the
 *   course AI Tutor after every unsynced file is ACTIVE.
 *
 * Access: Course owner (TEACHER) or ADMIN
 */

import { randomUUID } from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { type NextRequest } from "next/server";
import { MaterialType, UserRole } from "@prisma/client";

import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { requireRole } from "@/lib/auth/require-role";
import { verifyCourseOwner } from "@/lib/auth/check-ownership";
import prisma from "@/lib/prisma";
import { geminiService } from "@/lib/gemini/gemini.service";
import {
  ok,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api-response";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ courseId: string }> };

function getExtensionFromFileUrl(fileUrl: string): string {
  try {
    return path.extname(new URL(fileUrl).pathname).toLowerCase();
  } catch {
    return path.extname(fileUrl).toLowerCase();
  }
}

function isEligibleGeminiMaterial(material: {
  materialType: MaterialType;
  fileUrl: string;
}): boolean {
  const extension = getExtensionFromFileUrl(material.fileUrl);

  return (
    material.materialType === MaterialType.PDF ||
    extension === ".txt" ||
    extension === ".text" ||
    extension === ".md" ||
    extension === ".csv" ||
    extension === ".xlsx" ||
    extension === ".pptx"
  );
}

async function downloadMaterialToTempFile(material: {
  id: string;
  title: string;
  fileUrl: string;
}) {
  const response = await fetch(material.fileUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to download material "${material.id}" from UploadThing (${response.status}).`,
    );
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "learnai-gemini-"));
  const extension = getExtensionFromFileUrl(material.fileUrl) || path.extname(material.title);
  const filePath = path.join(tempDir, `${randomUUID()}${extension || ".upload"}`);
  const buffer = Buffer.from(await response.arrayBuffer());

  await fs.writeFile(filePath, buffer);

  return { filePath, tempDir };
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

      const tempFile = await downloadMaterialToTempFile(material);

      try {
        const uploadedFile = await geminiService.uploadFileToGemini(
          tempFile.filePath,
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
      } finally {
        await fs.rm(tempFile.tempDir, { recursive: true, force: true });
      }
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
