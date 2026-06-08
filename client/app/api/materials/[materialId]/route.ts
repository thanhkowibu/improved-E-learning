import { type NextRequest } from "next/server";
import { UTApi } from "uploadthing/server";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { verifyCourseOwner } from "@/lib/auth/check-ownership";
import { deleteMaterialRecord, getMaterialById } from "@/lib/services/material.service";
import {
  forbidden,
  noContent,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/api-response";

const utapi = new UTApi();

type RouteContext = { params: Promise<{ materialId: string }> };

function extractUploadThingFileKey(fileUrl: string): string {
  const parsedUrl = new URL(fileUrl);
  const segments = parsedUrl.pathname.split("/").filter(Boolean);
  const fileKey = segments.at(-1);

  if (!fileKey) {
    throw new Error("Unable to extract UploadThing file key.");
  }

  return decodeURIComponent(fileKey);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { materialId } = await context.params;
    const caller = await getAuthUser(request);

    const material = await getMaterialById(materialId);
    await verifyCourseOwner(caller, material.lesson.module.courseId);

    const fileKey = extractUploadThingFileKey(material.fileUrl);
    await utapi.deleteFiles(fileKey);

    await deleteMaterialRecord(materialId);

    return noContent();
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[DELETE /api/materials/:materialId]", err);
    return serverError();
  }
}
