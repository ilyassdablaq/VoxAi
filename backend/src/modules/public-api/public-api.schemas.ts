import { z } from "zod";

export const apiChatSchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
  language: z.string().min(2).max(8).optional(),
});

export type ApiChatInput = z.infer<typeof apiChatSchema>;
