import type { File as GeminiFile } from "@google/genai";
import { FileState } from "@google/genai";

import { ai } from "./client";

const FILE_POLL_INTERVAL_MS = 2_000;
const FILE_PROCESSING_TIMEOUT_MS = 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
}

export const geminiService = new GeminiService();
export { GeminiService };
