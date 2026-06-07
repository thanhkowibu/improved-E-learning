import prisma from "@/lib/prisma";
import { geminiService, type ChatHistoryItem } from "@/lib/gemini/gemini.service";
import { EnrollmentStatus } from "@prisma/client";

type ChatRole = "user" | "model";

export class ChatServiceError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 403 | 404 | 409 | 422 = 400
  ) {
    super(message);
    this.name = "ChatServiceError";
  }
}

function isChatRole(role: string): role is ChatRole {
  return role === "user" || role === "model";
}

class ChatService {
  private async assertActiveEnrollment(
    userId: string,
    courseId: string
  ): Promise<void> {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId: userId,
          courseId,
        },
      },
      select: { status: true },
    });

    if (enrollment?.status !== EnrollmentStatus.ACTIVE) {
      throw new ChatServiceError(
        "You must be actively enrolled in this course to use AI Tutor.",
        403
      );
    }
  }

  private async assertCourseReady(courseId: string): Promise<void> {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        aiEnabled: true,
        modules: {
          select: {
            lessons: {
              select: {
                materials: {
                  where: {
                    geminiFileUri: { not: null },
                  },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new ChatServiceError(`Course with id "${courseId}" not found.`, 404);
    }

    if (!course.aiEnabled) {
      throw new ChatServiceError(
        "AI Tutor is not enabled for this course.",
        403
      );
    }

    const syncedFileCount = course.modules.reduce(
      (total, module) =>
        total +
        module.lessons.reduce(
          (lessonTotal, lesson) => lessonTotal + lesson.materials.length,
          0
        ),
      0
    );

    if (syncedFileCount === 0) {
      throw new ChatServiceError(
        "AI Tutor is not ready because this course has no synced materials.",
        422
      );
    }
  }

  async createThread(userId: string, courseId: string) {
    await this.assertCourseReady(courseId);
    await this.assertActiveEnrollment(userId, courseId);

    return prisma.chatThread.create({
      data: {
        studentId: userId,
        courseId,
      },
    });
  }

  async getUserThreads(userId: string, courseId: string) {
    await this.assertCourseReady(courseId);
    await this.assertActiveEnrollment(userId, courseId);

    return prisma.chatThread.findMany({
      where: {
        studentId: userId,
        courseId,
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getThreadMessages(threadId: string, userId: string) {
    const thread = await prisma.chatThread.findFirst({
      where: {
        id: threadId,
        studentId: userId,
      },
      select: { id: true, courseId: true },
    });

    if (!thread) {
      throw new ChatServiceError(`Chat thread with id "${threadId}" not found.`, 404);
    }

    await this.assertActiveEnrollment(userId, thread.courseId);

    return prisma.chatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
    });
  }

  async deleteThread(threadId: string, userId: string) {
    const thread = await prisma.chatThread.findFirst({
      where: {
        id: threadId,
        studentId: userId,
      },
      select: { id: true },
    });

    if (!thread) {
      throw new ChatServiceError(`Chat thread with id "${threadId}" not found.`, 404);
    }

    return prisma.chatThread.delete({
      where: { id: threadId },
    });
  }

  async askQuestion(threadId: string, userId: string, message: string) {
    const thread = await prisma.chatThread.findFirst({
      where: {
        id: threadId,
        studentId: userId,
      },
      include: {
        course: {
          include: {
            modules: {
              include: {
                lessons: {
                  include: {
                    materials: {
                      select: {
                        geminiFileUri: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!thread) {
      throw new ChatServiceError(`Chat thread with id "${threadId}" not found.`, 404);
    }

    await this.assertActiveEnrollment(userId, thread.courseId);

    if (!thread.course.aiEnabled) {
      throw new ChatServiceError(
        "AI Tutor is not enabled for this course.",
        403
      );
    }

    const fileUris = thread.course.modules
      .flatMap((module) => module.lessons)
      .flatMap((lesson) => lesson.materials)
      .map((material) => material.geminiFileUri)
      .filter((fileUri): fileUri is string => Boolean(fileUri));

    if (fileUris.length === 0) {
      throw new ChatServiceError(
        "AI Tutor is not ready because this course has no synced materials.",
        422
      );
    }

    const userMessage = await prisma.chatMessage.create({
      data: {
        threadId,
        role: "user",
        content: message,
      },
    });

    const previousMessages = await prisma.chatMessage.findMany({
      where: {
        threadId,
        id: { not: userMessage.id },
      },
      orderBy: { createdAt: "asc" },
      select: {
        role: true,
        content: true,
      },
    });

    const history: ChatHistoryItem[] = previousMessages
      .filter((item): item is { role: ChatRole; content: string } =>
        isChatRole(item.role)
      )
      .map((item) => ({
        role: item.role,
        text: item.content,
      }));

    const answer = await geminiService.generateChatResponse(
      thread.course.title,
      message,
      fileUris,
      history
    );

    const assistantMessage = await prisma.chatMessage.create({
      data: {
        threadId,
        role: "model",
        content: answer,
      },
    });

    await prisma.chatThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });

    return {
      userMessage,
      assistantMessage,
    };
  }
}

export const chatService = new ChatService();
export { ChatService };
