import { randomUUID } from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { type NextRequest } from "next/server";
import { MaterialType, UserRole } from "@prisma/client";
import { AuthError, getAuthUser } from "@/lib/auth/get-auth-user";
import { requireRole } from "@/lib/auth/require-role";
import { verifyCourseOwner } from "@/lib/auth/check-ownership";
import { geminiService } from "@/lib/gemini/gemini.service";
import prisma from "@/lib/prisma";
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "@/lib/api-response";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    courseId: string;
    materialId: string;
  }>;
};

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
}) {
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
      `Failed to download material "${material.id}" from original file URL (${response.status}).`,
    );
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "learnai-gemini-resync-"));
  const extension = getExtensionFromFileUrl(material.fileUrl) || path.extname(material.title);
  const filePath = path.join(tempDir, `${randomUUID()}${extension || ".upload"}`);
  const buffer = Buffer.from(await response.arrayBuffer());

  await fs.writeFile(filePath, buffer);

  return { filePath, tempDir };
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { courseId, materialId } = await context.params;
    const caller = await getAuthUser(request);

    requireRole(caller, [UserRole.TEACHER, UserRole.ADMIN]);
    await verifyCourseOwner(caller, courseId);

    const material = await prisma.material.findFirst({
      where: {
        id: materialId,
        lesson: {
          module: {
            courseId,
          },
        },
      },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            module: {
              select: {
                id: true,
                title: true,
                courseId: true,
              },
            },
          },
        },
      },
    });

    if (!material) {
      return notFound(`Material with id "${materialId}" not found.`);
    }

    if (!isEligibleGeminiMaterial(material)) {
      return badRequest("Only PDF and text-like materials can be synced to Gemini.");
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

      const activeFile = await geminiService.waitForFileActive(uploadedFile.name);

      if (!activeFile.uri) {
        throw new Error(
          `Gemini file "${activeFile.name ?? uploadedFile.name}" became ACTIVE but did not return a URI.`,
        );
      }

      const updatedMaterial = await prisma.material.update({
        where: { id: material.id },
        data: {
          geminiFileName: activeFile.name ?? uploadedFile.name,
          geminiFileUri: activeFile.uri,
        },
        include: {
          lesson: {
            select: {
              id: true,
              title: true,
              module: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
      });

      return ok(updatedMaterial, "Material re-synced to Gemini successfully.");
    } finally {
      await fs.rm(tempFile.tempDir, { recursive: true, force: true });
    }
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }

    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }

    console.error("[POST /api/courses/:courseId/materials/:materialId/resync]", err);
    return serverError(
      err instanceof Error ? err.message : "Failed to re-sync material.",
    );
  }
}
