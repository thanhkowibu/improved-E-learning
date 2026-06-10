import type { Content, File as GeminiFile, Part } from "@google/genai";
import { FileState } from "@google/genai";

import { ai, DEFAULT_MODEL } from "./client";
import {
  getQuizGenerationSystemPrompt,
  getQuizGenerationUserPrompt,
  getTutorSystemPrompt,
  QUIZ_GENERATION_RESPONSE_SCHEMA,
} from "./prompts";

const FILE_POLL_INTERVAL_MS = 2_000;
const FILE_PROCESSING_TIMEOUT_MS = 60_000;
const RATE_LIMIT_RETRY_DELAY_MS = 2_000;

interface ChatHistoryItem {
  role: "user" | "model";
  text: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error && error.message.includes("429")) {
    return true;
  }

  if (typeof error !== "object" || error === null) {
    return false;
  }

  const maybeStatus = (error as { status?: unknown }).status;
  const maybeCode = (error as { code?: unknown }).code;

  return maybeStatus === 429 || maybeCode === 429;
}

class GeminiService {
  async uploadFileToGemini(
    filePath: string,
    displayName: string
  ): Promise<GeminiFile> {
    try {
      return await ai.files.upload({
        file: filePath,
        config: { displayName },
      });
    } catch (error) {
      console.error("Failed to upload file to Gemini.", {
        filePath,
        displayName,
        error,
      });
      throw error;
    }
  }

  async getGeminiFile(name: string): Promise<GeminiFile> {
    try {
      return await ai.files.get({ name });
    } catch (error) {
      console.error("Failed to get Gemini file.", { name, error });
      throw error;
    }
  }

  async deleteGeminiFile(name: string): Promise<void> {
    try {
      await ai.files.delete({ name });
    } catch (error) {
      console.error("Failed to delete Gemini file.", { name, error });
      throw error;
    }
  }

  async listGeminiFiles(): Promise<GeminiFile[]> {
    try {
      const pager = await ai.files.list();
      const files: GeminiFile[] = [];

      for await (const file of pager) {
        files.push(file);
      }

      return files;
    } catch (error) {
      console.error("Failed to list Gemini files.", { error });
      throw error;
    }
  }

  async waitForFileActive(name: string): Promise<GeminiFile> {
    const startedAt = Date.now();

    while (Date.now() - startedAt <= FILE_PROCESSING_TIMEOUT_MS) {
      try {
        const file = await this.getGeminiFile(name);

        if (file.state === FileState.ACTIVE) {
          return file;
        }

        if (file.state === FileState.FAILED) {
          const message =
            file.error?.message ?? "Gemini file processing failed.";
          throw new Error(message);
        }

        await sleep(FILE_POLL_INTERVAL_MS);
      } catch (error) {
        console.error("Failed while polling Gemini file state.", {
          name,
          error,
        });
        throw error;
      }
    }

    const timeoutError = new Error(
      `Timed out waiting for Gemini file "${name}" to become ACTIVE after ${FILE_PROCESSING_TIMEOUT_MS / 1000} seconds.`
    );

    console.error("Gemini file processing timed out.", {
      name,
      timeoutMs: FILE_PROCESSING_TIMEOUT_MS,
    });

    throw timeoutError;
  }

  async generateChatResponse(
    courseTitle: string,
    userMessage: string,
    fileUris: string[],
    history: ChatHistoryItem[]
  ): Promise<string> {
    const historyContents: Content[] = history.map((message) => ({
      role: message.role,
      parts: [{ text: message.text }],
    }));

    const fileParts: Part[] = fileUris.map((fileUri) => ({
      fileData: { fileUri },
    }));

    const contents: Content[] = [
      ...historyContents,
      {
        role: "user",
        parts: [...fileParts, { text: userMessage }],
      },
    ];

    const generate = async () =>
      ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents,
        config: {
          systemInstruction: getTutorSystemPrompt(courseTitle),
        },
      });

    try {
      let response: Awaited<ReturnType<typeof generate>>;

      try {
        response = await generate();
      } catch (error) {
        if (!isRateLimitError(error)) {
          throw error;
        }

        console.error("Gemini rate limit hit. Retrying once after delay.", {
          delayMs: RATE_LIMIT_RETRY_DELAY_MS,
          error,
        });
        await sleep(RATE_LIMIT_RETRY_DELAY_MS);
        response = await generate();
      }

      const candidate = response.candidates?.[0];

      console.log("Gemini chat usage metadata.", {
        promptTokenCount: response.usageMetadata?.promptTokenCount,
        candidatesTokenCount: response.usageMetadata?.candidatesTokenCount,
        totalTokenCount: response.usageMetadata?.totalTokenCount,
      });

      console.log("Gemini chat response metadata.", {
        finishReason: candidate?.finishReason,
        finishMessage: candidate?.finishMessage,
        safetyRatings: candidate?.safetyRatings,
        promptFeedback: response.promptFeedback,
      });

      if (response.promptFeedback?.blockReason) {
        throw new Error(
          response.promptFeedback.blockReasonMessage ??
            `Gemini blocked the prompt. Block reason: ${response.promptFeedback.blockReason}.`
        );
      }

      const responseText = response.text;
      if (!responseText) {
        throw new Error(
          candidate?.finishMessage ??
            `Gemini returned no response text. Finish reason: ${candidate?.finishReason ?? "unknown"}.`
        );
      }

      return responseText;
    } catch (error) {
      console.error("Failed to generate Gemini chat response.", {
        courseTitle,
        fileUriCount: fileUris.length,
        historyCount: history.length,
        error,
      });
      throw error;
    }
  }

  async generateQuizQuestions({
    lessonTitle,
    lessonContent,
    fileUris,
    numberOfQuestions,
  }: {
    lessonTitle: string;
    lessonContent: string;
    fileUris: string[];
    numberOfQuestions: number;
  }): Promise<string> {
    const fileParts: Part[] = fileUris.map((fileUri) => ({
      fileData: { fileUri },
    }));

    const contents: Content[] = [
      {
        role: "user",
        parts: [
          ...fileParts,
          {
            text: getQuizGenerationUserPrompt({
              lessonTitle,
              lessonContent,
              numberOfQuestions,
              materialCount: fileUris.length,
            }),
          },
        ],
      },
    ];

    const generate = async () =>
      ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents,
        config: {
          systemInstruction: getQuizGenerationSystemPrompt(numberOfQuestions),
          responseMimeType: "application/json",
          responseSchema: QUIZ_GENERATION_RESPONSE_SCHEMA,
        },
      });

    try {
      let response: Awaited<ReturnType<typeof generate>>;

      try {
        response = await generate();
      } catch (error) {
        if (!isRateLimitError(error)) {
          throw error;
        }

        console.error("Gemini quiz generation rate limit hit. Retrying once after delay.", {
          delayMs: RATE_LIMIT_RETRY_DELAY_MS,
          error,
        });
        await sleep(RATE_LIMIT_RETRY_DELAY_MS);
        response = await generate();
      }

      const candidate = response.candidates?.[0];

      console.log("Gemini quiz generation usage metadata.", {
        promptTokenCount: response.usageMetadata?.promptTokenCount,
        candidatesTokenCount: response.usageMetadata?.candidatesTokenCount,
        totalTokenCount: response.usageMetadata?.totalTokenCount,
      });

      console.log("Gemini quiz generation response metadata.", {
        finishReason: candidate?.finishReason,
        finishMessage: candidate?.finishMessage,
        safetyRatings: candidate?.safetyRatings,
        promptFeedback: response.promptFeedback,
      });

      if (response.promptFeedback?.blockReason) {
        throw new Error(
          response.promptFeedback.blockReasonMessage ??
            `Gemini blocked quiz generation. Block reason: ${response.promptFeedback.blockReason}.`
        );
      }

      const responseText = response.text;
      if (!responseText) {
        throw new Error(
          candidate?.finishMessage ??
            `Gemini returned no quiz JSON. Finish reason: ${candidate?.finishReason ?? "unknown"}.`
        );
      }

      return responseText;
    } catch (error) {
      console.error("Failed to generate Gemini quiz questions.", {
        lessonTitle,
        fileUriCount: fileUris.length,
        numberOfQuestions,
        error,
      });
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
export { GeminiService };
export type { ChatHistoryItem };
