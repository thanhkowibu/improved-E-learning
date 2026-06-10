import { Type, type Schema } from "@google/genai";

export function getTutorSystemPrompt(courseTitle: string): string {
  return `You are a helpful tutor for the course "${courseTitle}". Answer questions based ONLY on the provided course materials. If the answer is not in the materials, say so clearly. Cite specific sections where possible.`;
}

export const QUIZ_GENERATION_RESPONSE_SCHEMA: Schema = {
  type: Type.ARRAY,
  minItems: "1",
  items: {
    type: Type.OBJECT,
    required: ["questionText", "points", "explanation", "options"],
    propertyOrdering: ["questionText", "points", "explanation", "options"],
    properties: {
      questionText: {
        type: Type.STRING,
        minLength: "1",
        maxLength: "5000",
        description: "The question prompt shown to students.",
      },
      points: {
        type: Type.INTEGER,
        minimum: 1,
        maximum: 100,
        description: "Point value for the question. Use 1 unless the question is substantially more difficult.",
      },
      explanation: {
        type: Type.STRING,
        minLength: "1",
        maxLength: "5000",
        description: "A concise explanation of why the correct option is correct, grounded in the lesson materials.",
      },
      options: {
        type: Type.ARRAY,
        minItems: "4",
        maxItems: "4",
        description: "Exactly four answer options. Exactly one option must be correct.",
        items: {
          type: Type.OBJECT,
          required: ["optionText", "isCorrect"],
          propertyOrdering: ["optionText", "isCorrect"],
          properties: {
            optionText: {
              type: Type.STRING,
              minLength: "1",
              maxLength: "2000",
              description: "Answer option text.",
            },
            isCorrect: {
              type: Type.BOOLEAN,
              description: "True for exactly one option in this question; false for all distractors.",
            },
          },
        },
      },
    },
  },
};

export function getQuizGenerationSystemPrompt(numberOfQuestions: number): string {
  return [
    "You are an expert teacher and assessment designer.",
    `Generate exactly ${numberOfQuestions} multiple-choice quiz questions from the provided lesson content and attached course materials.`,
    "Ground every question in the supplied materials only. Do not invent facts outside the lesson text or files.",
    "Each question must have exactly four options and exactly one correct option.",
    "Use clear, unambiguous wording. Avoid trick questions unless the source material explicitly supports the distinction.",
    "Return only valid JSON matching the provided response schema.",
  ].join(" ");
}

export function getQuizGenerationUserPrompt({
  lessonTitle,
  lessonContent,
  numberOfQuestions,
  materialCount,
}: {
  lessonTitle: string;
  lessonContent: string;
  numberOfQuestions: number;
  materialCount: number;
}): string {
  return [
    `Lesson title: ${lessonTitle}`,
    `Requested question count: ${numberOfQuestions}`,
    `Attached Gemini file count: ${materialCount}`,
    "Lesson markdown content:",
    lessonContent.trim() || "(No lesson text was provided. Use the attached files if available.)",
  ].join("\n\n");
}
