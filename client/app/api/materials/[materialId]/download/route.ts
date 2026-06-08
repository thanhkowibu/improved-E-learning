import { type NextRequest, NextResponse } from "next/server";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { getMaterialById } from "@/lib/services/material.service";
import { forbidden, notFound, serverError, unauthorized } from "@/lib/api-response";

type RouteContext = { params: Promise<{ materialId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { materialId } = await context.params;
    const caller = await getAuthUser(request);
    const material = await getMaterialById(materialId);

    const course = material.lesson.module.course;
    if (!course.isPublished) {
      const isOwner = course.teacherId === caller.id;
      const isAdmin = caller.role === "ADMIN";
      if (!isOwner && !isAdmin) {
        return notFound("Material not found or course is not yet published.");
      }
    }

    return NextResponse.redirect(material.fileUrl);
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }
    console.error("[GET /api/materials/:materialId/download]", err);
    return serverError();
  }
}
