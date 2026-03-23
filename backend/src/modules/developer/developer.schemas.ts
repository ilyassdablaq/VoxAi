import { z } from "zod";

export const createApiKeySchema = z.object({
  name: z.string().min(2).max(80),
});

export const apiKeyIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
