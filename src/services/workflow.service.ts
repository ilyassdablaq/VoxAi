import { apiClient } from "@/lib/api-client";

export type WorkflowActionType = "create_ticket" | "escalate_conversation" | "send_follow_up" | "sync_crm";
export type WorkflowTriggerType = "conversation_created" | "conversation_escalated" | "ticket_requested" | "follow_up_due";

export interface WorkflowAction {
  type: WorkflowActionType;
  config: Record<string, unknown>;
}

export interface WorkflowTrigger {
  type: WorkflowTriggerType;
  config: Record<string, unknown>;
}

export interface Workflow {
  id: string;
  userId: string;
  name: string;
  description: string;
  isActive: boolean;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  userId: string;
  status: "SUCCESS" | "FAILED";
  output: {
    workflowName: string;
    actionResults: Array<{
      actionType: string;
      provider: string;
      status: string;
      detail: string;
    }>;
    executedAt: string;
  };
  createdAt: string;
}

export const workflowService = {
  listWorkflows(): Promise<Workflow[]> {
    return apiClient.get<Workflow[]>("/api/workflows");
  },

  createWorkflow(payload: {
    name: string;
    description: string;
    isActive: boolean;
    trigger: WorkflowTrigger;
    actions: WorkflowAction[];
  }): Promise<Workflow> {
    return apiClient.post<Workflow>("/api/workflows", payload);
  },

  updateWorkflow(
    id: string,
    payload: Partial<{
      name: string;
      description: string;
      isActive: boolean;
      trigger: WorkflowTrigger;
      actions: WorkflowAction[];
    }>,
  ): Promise<Workflow> {
    return apiClient.patch<Workflow>(`/api/workflows/${id}`, payload as Record<string, unknown>);
  },

  deleteWorkflow(id: string): Promise<void> {
    return apiClient.delete<void>(`/api/workflows/${id}`);
  },

  runWorkflow(id: string, eventPayload: Record<string, unknown> = {}): Promise<{
    workflowId: string;
    workflowName: string;
    executedAt: string;
    actionResults: Array<{
      actionType: string;
      provider: string;
      status: string;
      detail: string;
    }>;
  }> {
    return apiClient.post(`/api/workflows/${id}/run`, { eventPayload });
  },

  listRuns(workflowId?: string): Promise<WorkflowRun[]> {
    const query = workflowId ? `?workflowId=${encodeURIComponent(workflowId)}` : "";
    return apiClient.get<WorkflowRun[]>(`/api/workflows/runs${query}`);
  },
};
