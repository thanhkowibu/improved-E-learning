import { type NextRequest } from "next/server";
import { ZodError } from "zod";

import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { askMessageSchema } from "@/lib/validations/chat";
import { chatService, ChatServiceError } from "@/lib/services/chat.service";
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  error as apiError,
  serverError,
} from "@/lib/api-response";

type RouteContext = { params: Promise<{ threadId: string }> };

function serviceErrorResponse(error: ChatServiceError) {
  if (error.status === 403) return forbidden(error.message);
  if (error.status === 404) return notFound(error.message);
  return apiError(error.message, error.status);
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params;
    const caller = await getAuthUser(request);
    const body = await request.json();
    const parsed = askMessageSchema.parse(body);

    const messages = await chatService.askQuestion(
      threadId,
      caller.id,
      parsed.message
    );

    return ok(messages, "AI Tutor response generated successfully.");
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
    console.error("[POST /api/chat/threads/:threadId/ask]", err);
    return serverError();
  }
}
