import { z } from "zod";

const planTypeSchema = z.enum(["FREE", "PRO", "ENTERPRISE"]);

export const adminUserParamsSchema = z.object({
  userId: z.string().min(1),
});

export const setPlanOverrideSchema = z.object({
  plan: planTypeSchema,
  expiresAt: z
    .string()
    .datetime({ offset: true })
    .optional(),
  reason: z.string().trim().min(1).max(500).optional(),
});

export const adminUserSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export const overrideHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const adminAuditLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export type AdminUserParamsInput = z.infer<typeof adminUserParamsSchema>;
export type SetPlanOverrideInput = z.infer<typeof setPlanOverrideSchema>;
export type AdminUserSearchQueryInput = z.infer<typeof adminUserSearchQuerySchema>;
export type OverrideHistoryQueryInput = z.infer<typeof overrideHistoryQuerySchema>;
export type AdminAuditLogsQueryInput = z.infer<typeof adminAuditLogsQuerySchema>;
