import { type NextRequest } from "next/server";

import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { chatService, ChatServiceError } from "@/lib/services/chat.service";
import {
  ok,
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

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params;
    const caller = await getAuthUser(request);

    const messages = await chatService.getThreadMessages(threadId, caller.id);
    return ok(messages);
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    if (err instanceof ChatServiceError) {
      return serviceErrorResponse(err);
    }
    console.error("[GET /api/chat/threads/:threadId/messages]", err);
    return serverError();
  }
}
