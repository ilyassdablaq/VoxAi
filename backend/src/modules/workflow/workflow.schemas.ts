import { z } from "zod";

const triggerTypes = ["conversation_created", "conversation_escalated", "ticket_requested", "follow_up_due"] as const;
const actionTypes = ["create_ticket", "escalate_conversation", "send_follow_up", "sync_crm"] as const;

export const workflowActionSchema = z.object({
  type: z.enum(actionTypes),
  config: z.record(z.unknown()).default({}),
});

export const workflowTriggerSchema = z.object({
  type: z.enum(triggerTypes),
  config: z.record(z.unknown()).default({}),
});

export const createWorkflowSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(400).optional().default(""),
  isActive: z.boolean().default(true),
  trigger: workflowTriggerSchema,
  actions: z.array(workflowActionSchema).min(1).max(10),
});

export const updateWorkflowSchema = createWorkflowSchema.partial().refine((payload) => Object.keys(payload).length > 0, {
  message: "At least one field must be updated",
});

export const workflowIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const runWorkflowSchema = z.object({
  eventPayload: z.record(z.unknown()).optional().default({}),
});

export type WorkflowActionInput = z.infer<typeof workflowActionSchema>;
export type WorkflowTriggerInput = z.infer<typeof workflowTriggerSchema>;
export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;
export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>;
export type RunWorkflowInput = z.infer<typeof runWorkflowSchema>;
