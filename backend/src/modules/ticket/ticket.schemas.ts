import { z } from "zod";

const categoryTypes = ["technical", "billing", "account", "voice_quality", "integration", "other"] as const;
const priorityTypes = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const statusTypes = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

export const createTicketSchema = z.object({
  subject: z.string().min(3).max(140),
  description: z.string().min(10).max(4000),
  category: z.enum(categoryTypes).default("technical"),
  priority: z.enum(priorityTypes).default("MEDIUM"),
});

export const updateTicketSchema = z
  .object({
    subject: z.string().min(3).max(140).optional(),
    description: z.string().min(10).max(4000).optional(),
    category: z.enum(categoryTypes).optional(),
    priority: z.enum(priorityTypes).optional(),
    status: z.enum(statusTypes).optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field must be updated",
  });

export const ticketIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const createPublicTicketSchema = z.object({
  embedKey: z.string().min(16).max(128),
  visitorName: z.string().min(1).max(100),
  visitorEmail: z.string().email().max(200),
  subject: z.string().min(3).max(140),
  description: z.string().min(10).max(4000),
  category: z.enum(categoryTypes).default("technical"),
});

export type TicketCategory = (typeof categoryTypes)[number];
export type TicketPriority = (typeof priorityTypes)[number];
export type TicketStatus = (typeof statusTypes)[number];
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type CreatePublicTicketInput = z.infer<typeof createPublicTicketSchema>;
