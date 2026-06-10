import { z } from "zod";

const dueDateSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value === "string" || value instanceof Date) return new Date(value);
    return value;
  },
  z.date({ error: "dueDate must be a valid date." }).optional(),
);

const quizOptionSchema = z
  .object({
    optionText: z
      .string({ error: "Option text is required." })
      .min(1, "Option text cannot be empty.")
      .max(2_000, "Option text must be at most 2,000 characters.")
      .trim(),
    isCorrect: z.boolean({ error: "isCorrect must be a boolean." }),
  })
  .strict();

const quizQuestionSchema = z
  .object({
    questionText: z
      .string({ error: "Question text is required." })
      .min(1, "Question text cannot be empty.")
      .max(5_000, "Question text must be at most 5,000 characters.")
      .trim(),
    explanation: z
      .string({ error: "Explanation must be a string." })
      .max(5_000, "Explanation must be at most 5,000 characters.")
      .trim()
      .optional()
      .nullable(),
    points: z
      .number({ error: "Points must be a number." })
      .int("Points must be an integer.")
      .min(1, "Points must be at least 1.")
      .max(100, "Points must be at most 100."),
    options: z
      .array(quizOptionSchema, { error: "Options must be an array." })
      .min(2, "Each question must have at least 2 options.")
      .max(6, "Each question can have at most 6 options."),
  })
  .strict()
  .superRefine((question, ctx) => {
    const correctCount = question.options.filter((option) => option.isCorrect).length;

    if (correctCount !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Each question must have exactly one correct option.",
      });
    }
  });

export const quizQuestionsSchema = z
  .array(quizQuestionSchema, { error: "Questions must be an array." })
  .min(1, "A quiz must have at least 1 question.");

export const quizCreateSchema = z
  .object({
    maxAttempts: z
      .number({ error: "maxAttempts must be a number." })
      .int("maxAttempts must be an integer.")
      .min(1, "maxAttempts must be at least 1.")
      .max(100, "maxAttempts must be at most 100."),
    passingScore: z
      .number({ error: "passingScore must be a number." })
      .min(0, "passingScore must be at least 0.")
      .max(1, "passingScore must be at most 1."),
    dueDate: dueDateSchema,
    questions: quizQuestionsSchema,
  })
  .strict();

export const quizUpdateSchema = quizCreateSchema.partial().superRefine((data, ctx) => {
  if (data.questions !== undefined && data.questions.length < 1) {
    ctx.addIssue({
      code: "custom",
      path: ["questions"],
      message: "A quiz must have at least 1 question.",
    });
  }
});

export const quizSubmitSchema = z
  .object({
    answers: z
      .array(
        z
          .object({
            questionId: z.string({ error: "questionId is required." }).uuid("Invalid questionId."),
            optionId: z.string({ error: "optionId is required." }).uuid("Invalid optionId."),
          })
          .strict(),
        { error: "Answers must be an array." },
      )
      .min(1, "At least one answer is required."),
  })
  .strict()
  .superRefine((data, ctx) => {
    const seen = new Set<string>();

    data.answers.forEach((answer, index) => {
      if (seen.has(answer.questionId)) {
        ctx.addIssue({
          code: "custom",
          path: ["answers", index, "questionId"],
          message: "Each question can only be answered once.",
        });
      }
      seen.add(answer.questionId);
    });
  });

export type QuizCreateInput = z.infer<typeof quizCreateSchema>;
export type QuizUpdateInput = z.infer<typeof quizUpdateSchema>;
export type QuizSubmitInput = z.infer<typeof quizSubmitSchema>;
