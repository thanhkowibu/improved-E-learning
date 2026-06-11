import { type NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { AuthError, getAuthUser } from "@/lib/auth/get-auth-user";
import {
  badRequest,
  error as apiError,
  ok,
  serverError,
  unauthorized,
  forbidden,
} from "@/lib/api-response";
import { geminiService } from "@/lib/gemini/gemini.service";

const quizExplainSchema = z
  .object({
    questionText: z
      .string({ error: "questionText is required." })
      .min(1, "questionText cannot be empty.")
      .max(5_000, "questionText must be at most 5,000 characters."),
    options: z
      .array(
        z
          .string({ error: "Each option must be a string." })
          .min(1, "Options cannot be empty.")
          .max(2_000, "Each option must be at most 2,000 characters."),
        { error: "options must be an array." },
      )
      .min(2, "At least two options are required.")
      .max(6, "At most six options are allowed."),
    correctOption: z
      .string({ error: "correctOption is required." })
      .min(1, "correctOption cannot be empty.")
      .max(2_000, "correctOption must be at most 2,000 characters."),
    studentOption: z
      .string({ error: "studentOption is required." })
      .min(1, "studentOption cannot be empty.")
      .max(2_000, "studentOption must be at most 2,000 characters."),
  })
  .strict();

function zodIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}

function isRateLimitError(error: unknown) {
  if (error instanceof Error && error.message.includes("429")) return true;
  if (typeof error !== "object" || error === null) return false;

  const maybeStatus = (error as { status?: unknown }).status;
  const maybeCode = (error as { code?: unknown }).code;

  return maybeStatus === 429 || maybeCode === 429;
}

export async function POST(request: NextRequest) {
  try {
    await getAuthUser(request);

    const body = await request.json().catch(() => null);
    if (!body) {
      return badRequest("Request body must be valid JSON.");
    }

    const payload = quizExplainSchema.parse(body);
    const explanation = await geminiService.generateQuizExplanation(payload);

    return ok({ explanation });
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }

    if (err instanceof ZodError) {
      return badRequest("Validation failed.", zodIssues(err));
    }

    if (isRateLimitError(err)) {
      return apiError("Gemini rate limit reached. Please try again in a moment.", 429);
    }

    console.error("[POST /api/quiz/explain]", err);
    return serverError("Failed to generate quiz explanation.");
  }
}
