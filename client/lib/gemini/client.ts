import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY is not configured. Add GEMINI_API_KEY to your environment before using Gemini services."
  );
}

export const DEFAULT_MODEL = "gemini-3.1-flash-lite";

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
