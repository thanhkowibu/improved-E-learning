import { type NextRequest } from "next/server";
import { ZodError } from "zod";

import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { createThreadSchema } from "@/lib/validations/chat";
import { chatService, ChatServiceError } from "@/lib/services/chat.service";
import {
  ok,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  error as apiError,
  serverError,
} from "@/lib/api-response";

type RouteContext = { params: Promise<{ courseId: string }> };

function serviceErrorResponse(error: ChatServiceError) {
  if (error.status === 403) return forbidden(error.message);
  if (error.status === 404) return notFound(error.message);
  return apiError(error.message, error.status);
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { courseId } = await context.params;
    const caller = await getAuthUser(request);

    const threads = await chatService.getUserThreads(caller.id, courseId);
    return ok(threads);
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    if (err instanceof ChatServiceError) {
      return serviceErrorResponse(err);
    }
    console.error("[GET /api/courses/:courseId/chat/threads]", err);
    return serverError();
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { courseId } = await context.params;
    const caller = await getAuthUser(request);
    const parsed = createThreadSchema.parse({ courseId });

    const thread = await chatService.createThread(caller.id, parsed.courseId);
    return created(thread, "Chat thread created successfully.");
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    if (err instanceof ZodError) {
      return badRequest(
        "Validation failed.",
        err.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }))
      );
    }
    if (err instanceof ChatServiceError) {
      return serviceErrorResponse(err);
    }
    console.error("[POST /api/courses/:courseId/chat/threads]", err);
    return serverError();
  }
}
