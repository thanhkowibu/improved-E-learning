import { type NextRequest } from "next/server";
import { MaterialType } from "@prisma/client";
import { z, ZodError } from "zod";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { verifyCourseOwner } from "@/lib/auth/check-ownership";
import { getLessonById } from "@/lib/services/lesson.service";
import { createMaterial } from "@/lib/services/material.service";
import { ALLOWED_MIME_TYPES } from "@/lib/validations/material";
import {
  badRequest,
  created,
  forbidden,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/api-response";

const uploadThingMaterialSchema = z.object({
  name: z
    .string({ error: "File name must be a string." })
    .min(1, "File name is required.")
    .max(255, "File name must be at most 255 characters.")
    .trim(),
  url: z.string({ error: "File URL must be a string." }).url("File URL must be valid."),
  size: z
    .number({ error: "File size must be a number." })
    .int("File size must be an integer.")
    .nonnegative("File size cannot be negative."),
  type: z.string({ error: "File type must be a string." }).optional(),
});

type RouteContext = { params: Promise<{ lessonId: string }> };

function resolveMaterialType(mimeType?: string): MaterialType {
  if (!mimeType) return MaterialType.OTHER;
  return ALLOWED_MIME_TYPES[mimeType] ?? MaterialType.OTHER;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { lessonId } = await context.params;
    const caller = await getAuthUser(request);

    const lesson = await getLessonById(lessonId);
    await verifyCourseOwner(caller, lesson.module.courseId);

    const body = await request.json().catch(() => null);
    if (!body) {
      return badRequest("Request body must be valid JSON.");
    }

    const parsed = uploadThingMaterialSchema.parse(body);
    const material = await createMaterial({
      lessonId,
      title: parsed.name,
      materialType: resolveMaterialType(parsed.type),
      fileUrl: parsed.url,
      fileSizeBytes: BigInt(parsed.size),
    });

    return created(material, "Material uploaded successfully.");
  } catch (err) {
    if (err instanceof ZodError) {
      return badRequest(
        "Validation failed.",
        err.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }))
      );
    }
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[POST /api/lessons/:lessonId/materials/upload]", err);
    return serverError();
  }
}
