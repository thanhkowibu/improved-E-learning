import { type NextRequest } from "next/server";
import { LessonType } from "@prisma/client";
import { AuthError, getAuthUser } from "@/lib/auth/get-auth-user";
import { verifyCourseOwner } from "@/lib/auth/check-ownership";
import { getLessonById } from "@/lib/services/lesson.service";
import prisma from "@/lib/prisma";
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "@/lib/api-response";

type RouteContext = { params: Promise<{ lessonId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { lessonId } = await context.params;
    const caller = await getAuthUser(request);
    const lesson = await getLessonById(lessonId);

    if (lesson.lessonType !== LessonType.QUIZ) {
      return badRequest("Bài học này chưa được cấu hình là bài kiểm tra.");
    }

    await verifyCourseOwner(caller, lesson.module.courseId);

    const answers = await prisma.quizAnswer.findMany({
      where: {
        attempt: {
          quiz: {
            lessonId,
          },
          submittedAt: {
            not: null,
          },
        },
      },
      select: {
        questionId: true,
        question: {
          select: {
            questionText: true,
            options: {
              orderBy: {
                orderIndex: "asc",
              },
              select: {
                id: true,
                optionText: true,
                isCorrect: true,
              },
            },
          },
        },
        option: {
          select: {
            isCorrect: true,
          },
        },
      },
    });

    const grouped = new Map<
      string,
      {
        questionText: string;
        options: {
          id: string;
          text: string;
          isCorrect: boolean;
        }[];
        totalAttempts: number;
        wrongCount: number;
      }
    >();

    for (const answer of answers) {
      const current = grouped.get(answer.questionId) ?? {
        questionText: answer.question.questionText,
        options: answer.question.options.map((option) => ({
          id: option.id,
          text: option.optionText,
          isCorrect: option.isCorrect,
        })),
        totalAttempts: 0,
        wrongCount: 0,
      };

      current.totalAttempts += 1;
      if (!answer.option.isCorrect) {
        current.wrongCount += 1;
      }

      grouped.set(answer.questionId, current);
    }

    const stats = Array.from(grouped.values())
      .map((item) => ({
        ...item,
        errorRatePercentage:
          item.totalAttempts === 0
            ? 0
            : Math.round((item.wrongCount / item.totalAttempts) * 100),
      }))
      .sort((a, b) => b.errorRatePercentage - a.errorRatePercentage)
      .slice(0, 5);

    return ok(stats);
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403
        ? forbidden(err.message)
        : unauthorized(err.message);
    }

    if (err instanceof Error && err.message.includes("not found")) {
      return notFound(err.message);
    }

    console.error("[GET /api/lessons/:lessonId/quiz/analytics]", err);
    return serverError("Không thể tải phân tích câu hỏi.");
  }
}
