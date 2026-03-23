import { z } from "zod";

export const analyticsQuerySchema = z.object({
  range: z.enum(["7d", "30d", "90d", "365d"]).default("30d"),
  conversationId: z.string().uuid().optional(),
});

export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;
