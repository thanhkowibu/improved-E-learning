import { z } from "zod";

export const createThreadSchema = z.object({
  courseId: z.string({ error: "Course ID is required." }).uuid(
    "Course ID must be a valid UUID."
  ),
});

export const askMessageSchema = z.object({
  message: z
    .string({ error: "Message is required." })
    .trim()
    .min(1, "Message cannot be empty.")
    .max(2000, "Message must be at most 2000 characters."),
});

export type CreateThreadInput = z.infer<typeof createThreadSchema>;
export type AskMessageInput = z.infer<typeof askMessageSchema>;
