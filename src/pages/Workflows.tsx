import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Play, Plus, Trash2, Lock } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { WorkflowActionType, WorkflowTriggerType, workflowService } from "@/services/workflow.service";

const TRIGGERS: Array<{ value: WorkflowTriggerType; label: string }> = [
  { value: "conversation_created", label: "Conversation created" },
  { value: "conversation_escalated", label: "Conversation escalated" },
  { value: "ticket_requested", label: "Ticket requested" },
  { value: "follow_up_due", label: "Follow-up due" },
];

const ACTIONS: Array<{ value: WorkflowActionType; label: string }> = [
  { value: "create_ticket", label: "Create support ticket" },
  { value: "escalate_conversation", label: "Escalate conversation" },
  { value: "send_follow_up", label: "Send follow-up" },
  { value: "sync_crm", label: "Sync CRM" },
];

export default function Workflows() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canAccess } = useFeatureAccess();
  const hasAccess = canAccess("workflows");

  const [name, setName] = useState("High Priority Escalation");
  const [description, setDescription] = useState("Escalate important customer conversations and sync CRM.");
  const [triggerType, setTriggerType] = useState<WorkflowTriggerType>("conversation_escalated");
  const [actionType, setActionType] = useState<WorkflowActionType>("create_ticket");

  const workflowsQuery = useQuery({
    queryKey: ["workflows"],
    queryFn: () => workflowService.listWorkflows(),
  });

  const runsQuery = useQuery({
    queryKey: ["workflow-runs"],
    queryFn: () => workflowService.listRuns(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      workflowService.createWorkflow({
        name,
        description,
        isActive: true,
        trigger: {
          type: triggerType,
          config: { source: "dashboard" },
        },
        actions: [
          { type: actionType, config: { provider: actionType === "sync_crm" ? "salesforce" : "zendesk" } },
          { type: "send_follow_up", config: { delayMinutes: 20 } },
        ],
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast({ title: "Workflow created", description: "Automation workflow is now active." });
    },
    onError: (error) => {
      toast({
        title: "Create failed",
        description: error instanceof Error ? error.message : "Unable to create workflow",
        variant: "destructive",
      });
    },
  });

  const runMutation = useMutation({
    mutationFn: (id: string) => workflowService.runWorkflow(id, { source: "manual-test", createdAt: new Date().toISOString() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workflow-runs"] });
      toast({ title: "Workflow executed", description: "Run completed successfully." });
    },
    onError: (error) => {
      toast({
        title: "Execution failed",
        description: error instanceof Error ? error.message : "Unable to execute workflow",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workflowService.deleteWorkflow(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast({ title: "Workflow removed", description: "Automation deleted." });
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Unable to delete workflow",
        variant: "destructive",
      });
    },
  });

  const isBusy = createMutation.isPending || runMutation.isPending || deleteMutation.isPending;

  const latestRuns = useMemo(() => runsQuery.data?.slice(0, 8) ?? [], [runsQuery.data]);

  return (
    <DashboardShell
      title="Workflow Automation"
      description="Automate support tickets, conversation escalations, CRM syncs, and follow-up messaging."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Create Workflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm">Workflow Name</label>
              <Input value={name} onChange={(event) => setName(event.target.value)} disabled={isBusy} />
            </div>

            <div className="space-y-2">
              <label className="text-sm">Description</label>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} disabled={isBusy} />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm">Trigger</label>
                <select
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={triggerType}
                  onChange={(event) => setTriggerType(event.target.value as WorkflowTriggerType)}
                  disabled={isBusy}
                >
                  {TRIGGERS.map((trigger) => (
                    <option key={trigger.value} value={trigger.value}>
                      {trigger.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm">Primary Action</label>
                <select
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={actionType}
                  onChange={(event) => setActionType(event.target.value as WorkflowActionType)}
                  disabled={isBusy}
                >
                  {ACTIONS.map((action) => (
                    <option key={action.value} value={action.value}>
                      {action.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button 
              onClick={() => createMutation.mutate()} 
              disabled={!name.trim() || !description.trim() || isBusy || !hasAccess}
              className="relative"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Save Workflow
              {!hasAccess && <Lock className="w-3 h-3 ml-2" />}
            </Button>
            {!hasAccess && (
              <p className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1">
                <span className="inline-block bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded text-xs font-medium">Pro Only</span>
                Upgrade to Pro to create workflows
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Workflows</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {workflowsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading workflows...</p> : null}
            {!workflowsQuery.isLoading && (workflowsQuery.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No workflows yet. Create your first automation.</p>
            ) : null}
            <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
              {workflowsQuery.data?.map((workflow) => (
                <div key={workflow.id} className="rounded-md border border-border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{workflow.name}</p>
                      <p className="text-xs text-muted-foreground">{workflow.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Trigger: {workflow.trigger.type} • Actions: {workflow.actions.map((action) => action.type).join(", ")}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => runMutation.mutate(workflow.id)} 
                        disabled={isBusy || !hasAccess}
                        title={!hasAccess ? "Pro feature" : "Run workflow"}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => deleteMutation.mutate(workflow.id)} 
                        disabled={isBusy || !hasAccess}
                        title={!hasAccess ? "Pro feature" : "Delete workflow"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Execution History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {runsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading run history...</p> : null}
            {!runsQuery.isLoading && latestRuns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No runs yet. Execute a workflow to see action logs.</p>
            ) : null}
            {latestRuns.map((run) => (
              <div key={run.id} className="rounded-md border border-border p-3">
                <p className="text-sm font-medium">{run.output.workflowName}</p>
                <p className="text-xs text-muted-foreground">{new Date(run.createdAt).toLocaleString()} • {run.status}</p>
                <ul className="mt-2 text-xs text-muted-foreground list-disc pl-4">
                  {run.output.actionResults.map((action, index) => (
                    <li key={`${run.id}-${index}`}>{action.detail}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
