import { randomUUID } from "node:crypto";
import { AppError } from "../../common/errors/app-error.js";
import { CreateWorkflowInput, RunWorkflowInput, UpdateWorkflowInput } from "./workflow.schemas.js";
import { WorkflowRepository } from "./workflow.repository.js";

type ActionExecutionResult = {
  actionType: string;
  provider: string;
  status: "executed" | "skipped";
  detail: string;
};

function resolveProvider(actionType: string, config: Record<string, unknown>): string {
  if (typeof config.provider === "string" && config.provider.length > 0) {
    return config.provider;
  }

  if (actionType === "create_ticket") {
    return "helpdesk";
  }

  if (actionType === "sync_crm") {
    return "crm";
  }

  return "internal";
}

export class WorkflowService {
  constructor(private readonly repository: WorkflowRepository) {}

  async listWorkflows(userId: string) {
    return this.repository.listByUser(userId);
  }

  async createWorkflow(userId: string, payload: CreateWorkflowInput) {
    return this.repository.create({
      id: randomUUID(),
      userId,
      name: payload.name,
      description: payload.description,
      isActive: payload.isActive,
      trigger: payload.trigger,
      actions: payload.actions,
    });
  }

  async updateWorkflow(userId: string, id: string, payload: UpdateWorkflowInput) {
    const existing = await this.repository.getById(userId, id);
    if (!existing) {
      throw new AppError(404, "WORKFLOW_NOT_FOUND", "Workflow not found");
    }

    return this.repository.update({
      id,
      userId,
      name: payload.name ?? existing.name,
      description: payload.description ?? existing.description,
      isActive: payload.isActive ?? existing.isActive,
      trigger: payload.trigger ?? existing.trigger,
      actions: payload.actions ?? existing.actions,
    });
  }

  async deleteWorkflow(userId: string, id: string) {
    const deletedRows = await this.repository.delete(userId, id);
    if (deletedRows === 0) {
      throw new AppError(404, "WORKFLOW_NOT_FOUND", "Workflow not found");
    }
  }

  async runWorkflow(userId: string, id: string, payload: RunWorkflowInput) {
    const workflow = await this.repository.getById(userId, id);
    if (!workflow) {
      throw new AppError(404, "WORKFLOW_NOT_FOUND", "Workflow not found");
    }

    if (!workflow.isActive) {
      throw new AppError(400, "WORKFLOW_INACTIVE", "Workflow is inactive");
    }

    const actionResults: ActionExecutionResult[] = workflow.actions.map((action) => {
      const provider = resolveProvider(action.type, action.config);

      switch (action.type) {
        case "create_ticket":
          return {
            actionType: action.type,
            provider,
            status: "executed",
            detail: `Ticket created in ${provider.toUpperCase()} queue (${String(action.config.queue ?? "default")})`,
          };
        case "escalate_conversation":
          return {
            actionType: action.type,
            provider,
            status: "executed",
            detail: `Conversation escalated to ${String(action.config.team ?? "senior-support")}`,
          };
        case "send_follow_up":
          return {
            actionType: action.type,
            provider,
            status: "executed",
            detail: `Follow-up message scheduled after ${String(action.config.delayMinutes ?? 30)} minutes`,
          };
        case "sync_crm":
          return {
            actionType: action.type,
            provider,
            status: "executed",
            detail: `Conversation synced to ${provider.toUpperCase()} pipeline ${String(action.config.pipeline ?? "general")}`,
          };
        default:
          return {
            actionType: action.type,
            provider,
            status: "skipped",
            detail: "Unknown action type",
          };
      }
    });

    const runResult = {
      workflowId: workflow.id,
      workflowName: workflow.name,
      trigger: workflow.trigger,
      eventPayload: payload.eventPayload,
      actionResults,
      executedAt: new Date().toISOString(),
    };

    await this.repository.createRun({
      id: randomUUID(),
      workflowId: workflow.id,
      userId,
      status: "SUCCESS",
      output: runResult,
    });

    return runResult;
  }

  async listRuns(userId: string, workflowId?: string) {
    return this.repository.listRuns(userId, workflowId);
  }
}
