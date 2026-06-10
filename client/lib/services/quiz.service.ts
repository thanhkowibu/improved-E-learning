import { UserRole, type Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type {
  QuizCreateInput,
  QuizSubmitInput,
  QuizUpdateInput,
} from "@/lib/validations/quiz";

export class QuizServiceError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "QuizServiceError";
  }
}

const quizQuestionInclude = {
  questions: {
    orderBy: { orderIndex: "asc" },
    include: {
      options: {
        orderBy: { orderIndex: "asc" },
      },
    },
  },
} satisfies Prisma.QuizInclude;

type QuizWithQuestions = Prisma.QuizGetPayload<{
  include: typeof quizQuestionInclude;
}>;

type StudentQuizOption = Omit<
  QuizWithQuestions["questions"][number]["options"][number],
  "isCorrect"
>;

type StudentQuizQuestion = Omit<
  QuizWithQuestions["questions"][number],
  "options"
> & {
  options: StudentQuizOption[];
};

type StudentSafeQuiz = Omit<QuizWithQuestions, "questions"> & {
  questions: StudentQuizQuestion[];
};

function buildQuestionCreates(
  questions: QuizCreateInput["questions"],
): Prisma.QuizQuestionCreateWithoutQuizInput[] {
  return questions.map((question, questionIndex) => ({
    questionText: question.questionText,
    explanation: question.explanation ?? null,
    points: question.points,
    orderIndex: questionIndex,
    options: {
      create: question.options.map((option, optionIndex) => ({
        optionText: option.optionText,
        isCorrect: option.isCorrect,
        orderIndex: optionIndex,
      })),
    },
  }));
}

function sanitizeQuizForStudent(quiz: QuizWithQuestions): StudentSafeQuiz {
  return {
    ...quiz,
    questions: quiz.questions.map((question) => ({
      ...question,
      options: question.options.map(({ isCorrect: _isCorrect, ...option }) => option),
    })),
  };
}

export async function createQuiz(lessonId: string, data: QuizCreateInput) {
  try {
    return await prisma.quiz.create({
      data: {
        lessonId,
        dueDate: data.dueDate,
        maxAttempts: data.maxAttempts,
        passingScore: data.passingScore,
        questions: {
          create: buildQuestionCreates(data.questions),
        },
      },
      include: quizQuestionInclude,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      throw new QuizServiceError("This lesson already has a quiz.", 409);
    }
    console.error("[quiz.service:createQuiz]", err);
    throw err;
  }
}

export async function getQuizByLessonId(
  lessonId: string,
  role: UserRole,
): Promise<QuizWithQuestions | StudentSafeQuiz> {
  const quiz = await prisma.quiz.findUnique({
    where: { lessonId },
    include: quizQuestionInclude,
  });

  if (!quiz) {
    throw new QuizServiceError(`Quiz for lesson "${lessonId}" not found.`, 404);
  }

  if (role === UserRole.STUDENT) {
    return sanitizeQuizForStudent(quiz);
  }

  return quiz;
}

export async function updateQuiz(quizId: string, data: QuizUpdateInput) {
  const existing = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: {
      id: true,
      _count: {
        select: { attempts: true },
      },
    },
  });

  if (!existing) {
    throw new QuizServiceError(`Quiz with id "${quizId}" not found.`, 404);
  }

  if (data.questions !== undefined && existing._count.attempts > 0) {
    throw new QuizServiceError(
      "Cannot update quiz questions or options after students have submitted attempts.",
      409,
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      if (data.questions !== undefined) {
        await tx.quizQuestion.deleteMany({
          where: { quizId },
        });
      }

      const updateData: Prisma.QuizUpdateInput = {};

      if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
      if (data.maxAttempts !== undefined) updateData.maxAttempts = data.maxAttempts;
      if (data.passingScore !== undefined) updateData.passingScore = data.passingScore;
      if (data.questions !== undefined) {
        updateData.questions = {
          create: buildQuestionCreates(data.questions),
        };
      }

      return tx.quiz.update({
        where: { id: quizId },
        data: updateData,
        include: quizQuestionInclude,
      });
    });
  } catch (err) {
    console.error("[quiz.service:updateQuiz]", err);
    throw err;
  }
}

export async function deleteQuiz(quizId: string) {
  try {
    return await prisma.quiz.delete({
      where: { id: quizId },
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Record to delete does not exist")) {
      throw new QuizServiceError(`Quiz with id "${quizId}" not found.`, 404);
    }
    console.error("[quiz.service:deleteQuiz]", err);
    throw err;
  }
}

export async function submitAttempt(
  quizId: string,
  studentId: string,
  answers: QuizSubmitInput["answers"],
) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        include: {
          options: true,
        },
      },
      attempts: {
        where: { studentId },
        select: { id: true },
      },
    },
  });

  if (!quiz) {
    throw new QuizServiceError(`Quiz with id "${quizId}" not found.`, 404);
  }

  if (quiz.dueDate && quiz.dueDate.getTime() < Date.now()) {
    throw new QuizServiceError("This quiz is closed because the due date has passed.", 403);
  }

  if (quiz.attempts.length >= quiz.maxAttempts) {
    throw new QuizServiceError("You have reached the maximum number of attempts for this quiz.", 409);
  }

  const questionsById = new Map(quiz.questions.map((question) => [question.id, question]));
  const answersByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer]));

  if (answersByQuestionId.size !== quiz.questions.length) {
    throw new QuizServiceError("You must answer every question before submitting.", 400);
  }

  let earnedPoints = 0;
  const totalPoints = quiz.questions.reduce((sum, question) => sum + question.points, 0);

  for (const answer of answers) {
    const question = questionsById.get(answer.questionId);

    if (!question) {
      throw new QuizServiceError("Submitted answers include a question outside this quiz.", 400);
    }

    const selectedOption = question.options.find((option) => option.id === answer.optionId);

    if (!selectedOption) {
      throw new QuizServiceError("Submitted answers include an option outside its question.", 400);
    }

    if (selectedOption.isCorrect) {
      earnedPoints += question.points;
    }
  }

  return prisma.quizAttempt.create({
    data: {
      quizId,
      studentId,
      score: earnedPoints,
      totalPoints,
      submittedAt: new Date(),
      answers: {
        create: answers.map((answer) => ({
          questionId: answer.questionId,
          optionId: answer.optionId,
        })),
      },
    },
    include: {
      answers: {
        include: {
          question: {
            include: {
              options: {
                orderBy: { orderIndex: "asc" },
              },
            },
          },
          option: true,
        },
      },
    },
  });
}

export async function getAttempts(quizId: string, studentId?: string) {
  return prisma.quizAttempt.findMany({
    where: {
      quizId,
      ...(studentId ? { studentId } : {}),
    },
    include: {
      answers: {
        include: {
          question: {
            include: {
              options: {
                orderBy: { orderIndex: "asc" },
              },
            },
          },
          option: true,
        },
      },
      student: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
    orderBy: { startedAt: "desc" },
  });
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export async function getQuizSubmissionsForTeacher(quizId: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true },
  });

  if (!quiz) {
    throw new QuizServiceError(`Quiz with id "${quizId}" not found.`, 404);
  }

  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId },
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          email: true,
        },
      },
    },
    orderBy: [
      { submittedAt: { sort: "desc", nulls: "last" } },
      { startedAt: "desc" },
    ],
  });

  return attempts.map((attempt) => {
    const { firstName, lastName } = splitFullName(attempt.student.fullName);

    return {
      ...attempt,
      student: {
        id: attempt.student.id,
        firstName,
        lastName,
        imageUrl: attempt.student.avatarUrl,
        email: attempt.student.email,
      },
    };
  });
}
