import { z } from "zod";

export const voiceSettingsSchema = z.object({
  provider: z.enum(["mock", "elevenlabs"]).default("elevenlabs"),
  voiceId: z.string().min(2).max(120).optional().nullable(),
  speed: z.number().min(0.7).max(1.3).default(1),
  style: z.number().min(0).max(1).default(0.5),
  stability: z.number().min(0).max(1).default(0.5),
});

export type VoiceSettingsInput = z.infer<typeof voiceSettingsSchema>;
