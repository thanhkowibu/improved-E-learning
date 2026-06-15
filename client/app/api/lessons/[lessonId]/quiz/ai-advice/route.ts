import { type NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { LessonType } from "@prisma/client";
import { AuthError, getAuthUser } from "@/lib/auth/get-auth-user";
import { verifyCourseOwner } from "@/lib/auth/check-ownership";
import { getLessonById } from "@/lib/services/lesson.service";
import { geminiService } from "@/lib/gemini/gemini.service";
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "@/lib/api-response";

const adviceSchema = z.object({
  topQuestions: z
    .array(
      z.object({
        questionText: z.string().min(1, "Nội dung câu hỏi không được để trống."),
        errorRatePercentage: z
          .number()
          .min(0, "Tỷ lệ sai không hợp lệ.")
          .max(100, "Tỷ lệ sai không hợp lệ."),
      }),
    )
    .min(1, "Cần có ít nhất một câu hỏi để phân tích.")
    .max(5, "Chỉ có thể phân tích tối đa 5 câu hỏi."),
});

type RouteContext = { params: Promise<{ lessonId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { lessonId } = await context.params;
    const caller = await getAuthUser(request);
    const lesson = await getLessonById(lessonId);

    if (lesson.lessonType !== LessonType.QUIZ) {
      return badRequest("Bài học này chưa được cấu hình là bài kiểm tra.");
    }

    await verifyCourseOwner(caller, lesson.module.courseId);

    const body = await request.json();
    const parsed = adviceSchema.parse(body);

    const advice = await geminiService.generateQuizTeachingAdvice(
      parsed.topQuestions,
    );

    return ok({ advice });
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403
        ? forbidden(err.message)
        : unauthorized(err.message);
    }

    if (err instanceof ZodError) {
      return badRequest(
        "Dữ liệu phân tích không hợp lệ.",
        err.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      );
    }

    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }

    console.error("[POST /api/lessons/:lessonId/quiz/ai-advice]", err);
    return serverError("Không thể tạo gợi ý từ AI Tutor.");
  }
}
