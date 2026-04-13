import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Users, ServerCog, History, Activity, AlertCircle, LockKeyhole, Menu } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { adminService, type AdminAuditLogItem, type AdminUserSearchResult } from "@/services/admin.service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { AdminUserTable } from "@/components/admin/AdminUserTable";
import { OverrideControls } from "@/components/admin/OverrideControls";
import { AuditLogTable } from "@/components/admin/AuditLogTable";

const AUDIT_PAGE_SIZE = 10;

type PendingAction =
  | {
      kind: "set";
      plan: "FREE" | "PRO";
    }
  | {
      kind: "remove";
    }
  | null;

function toIsoDateTime(localDateTime: string): string | undefined {
  if (!localDateTime) {
    return undefined;
  }

  const date = new Date(localDateTime);
  if (Number.isNaN(date.valueOf())) {
    return undefined;
  }

  return date.toISOString();
}

function toLocalDateTimeInput(value?: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "";
  }

  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function formatPlan(value?: string | null) {
  return value ?? "FREE";
}

const Admin = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUserSearchResult | null>(null);
  const [reason, setReason] = useState("Internal QA override");
  const [expiresAtLocal, setExpiresAtLocal] = useState("");
  const [auditPage, setAuditPage] = useState(1);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  const trimmedSearch = searchValue.trim();
  const searchEnabled = trimmedSearch.length >= 2;

  const usersQuery = useQuery({
    queryKey: ["admin", "users", trimmedSearch],
    queryFn: () => adminService.searchUsers(trimmedSearch, 10),
    enabled: searchEnabled,
  });

  const effectiveAccessQuery = useQuery({
    queryKey: ["admin", "effective-access", selectedUser?.id],
    queryFn: () => adminService.getEffectiveAccess(selectedUser!.id),
    enabled: Boolean(selectedUser?.id),
  });

  const auditLogsQuery = useQuery({
    queryKey: ["admin", "audit-logs", auditPage],
    queryFn: () => adminService.getAuditLogs({ limit: AUDIT_PAGE_SIZE, offset: (auditPage - 1) * AUDIT_PAGE_SIZE }),
  });

  const refreshAdminData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "effective-access", selectedUser?.id] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] }),
    ]);
  };

  const setOverrideMutation = useMutation({
    mutationFn: async (plan: "FREE" | "PRO") => {
      if (!selectedUser) {
        throw new Error("Select a user first.");
      }

      return adminService.setPlanOverride(selectedUser.id, {
        plan,
        reason: reason.trim() || undefined,
        expiresAt: toIsoDateTime(expiresAtLocal),
      });
    },
    onSuccess: async () => {
      await refreshAdminData();
      setConfirmationOpen(false);
      setPendingAction(null);
      toast({
        title: "Override applied",
        description: `Override updated for ${selectedUser?.email}.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to apply override",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const removeOverrideMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) {
        throw new Error("Select a user first.");
      }

      return adminService.removeOverride(selectedUser.id);
    },
    onSuccess: async () => {
      await refreshAdminData();
      setConfirmationOpen(false);
      setPendingAction(null);
      toast({
        title: "Override removed",
        description: `Override cleared for ${selectedUser?.email}.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to remove override",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const selectedAccess = effectiveAccessQuery.data ?? null;
  const effectivePlan = selectedAccess?.effectivePlan.type ?? "FREE";
  const currentPlan = selectedAccess?.subscriptionPlan?.type ?? "FREE";
  const overrideState = selectedAccess?.override;

  const navigationItems = useMemo(
    () => [
      { id: "user-management", label: "User Management", icon: Users },
      { id: "subscription-overrides", label: "Subscription Overrides", icon: Shield },
      { id: "system-monitoring", label: "System Monitoring", icon: ServerCog },
      { id: "audit-logs", label: "Audit Logs", icon: History },
    ],
    [],
  );

  const selectedSectionSummary = selectedUser
    ? `${selectedUser.fullName} · ${selectedUser.email}`
    : "No user selected";

  const openSetPlanConfirmation = (plan: "FREE" | "PRO") => {
    setPendingAction({ kind: "set", plan });
    setConfirmationOpen(true);
  };

  const openRemoveConfirmation = () => {
    setPendingAction({ kind: "remove" });
    setConfirmationOpen(true);
  };

  const handleSearch = () => {
    const nextValue = searchInput.trim();
    setSearchValue(nextValue);
    setSelectedUser(null);
    setAuditPage(1);
  };

  const handleSelectUser = (userRow: AdminUserSearchResult) => {
    setSelectedUser(userRow);
  };

  useEffect(() => {
    setExpiresAtLocal(toLocalDateTimeInput(selectedAccess?.override?.expiresAt ?? null));
  }, [selectedAccess?.override?.expiresAt, selectedUser?.id]);

  const statusChips = [
    { label: "Admin-only", value: user?.role === "ADMIN" ? "Enabled" : "Hidden" },
    { label: "Rate limit", value: "60 req/min" },
    { label: "Audit trail", value: `${auditLogsQuery.data?.total ?? 0} records` },
  ];

  const confirmationTitle = pendingAction?.kind === "remove" ? "Remove override" : `Set ${pendingAction?.plan ?? "PRO"}`;
  const confirmationDescription =
    pendingAction?.kind === "remove"
      ? `Remove the active override for ${selectedUser?.email ?? "this user"}. The user will fall back to their subscription plan.`
      : `Apply a ${pendingAction?.plan ?? "PRO"} override to ${selectedUser?.email ?? "this user"}. This will be recorded in the audit log.`;

  const isSaving = setOverrideMutation.isPending || removeOverrideMutation.isPending;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-72 shrink-0 flex-col rounded-3xl border border-border/70 bg-card/90 p-4 shadow-sm backdrop-blur lg:flex">
          <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Shield className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Admin Dashboard</p>
                <p className="truncate text-xs text-muted-foreground">{user?.fullName ?? "Internal admin"}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge>ADMIN</Badge>
              <Badge variant="outline">/api/admin/*</Badge>
            </div>
          </div>

          <nav className="mt-5 space-y-2">
            {navigationItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-border/70 hover:bg-accent hover:text-foreground"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </a>
            ))}
          </nav>

          <Separator className="my-5" />

          <Card className="border-border/70 bg-muted/20">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <LockKeyhole className="h-4 w-4 text-primary" />
                Access controls
              </div>
              <p className="text-sm text-muted-foreground">
                Access is enforced server-side with admin role checks and IP allowlisting.
              </p>
              <div className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current focus</div>
                <div className="mt-1 font-medium">{selectedSectionSummary}</div>
              </div>
            </CardContent>
          </Card>
        </aside>

        <main className="min-w-0 flex-1 space-y-6 pb-8">
          <section className="overflow-hidden rounded-3xl border border-border/70 bg-card/90 shadow-sm backdrop-blur">
            <div className="border-b border-border/70 bg-gradient-to-r from-slate-50 via-background to-slate-100 p-6 dark:from-slate-950 dark:via-background dark:to-slate-950 sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Menu className="h-4 w-4" />
                    Internal operations
                  </div>
                  <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Admin Dashboard</h1>
                    <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
                      Search users, inspect effective plan access, apply temporary overrides, and review recent admin actions.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {statusChips.map((chip) => (
                    <div key={chip.label} className="rounded-2xl border border-border/70 bg-background px-4 py-3 shadow-sm">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{chip.label}</div>
                      <div className="mt-1 text-sm font-semibold">{chip.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 p-4 sm:grid-cols-3 lg:hidden">
              {navigationItems.map((item) => (
                <Button key={item.id} variant="outline" asChild className="justify-start">
                  <a href={`#${item.id}`}>
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </a>
                </Button>
              ))}
            </div>
          </section>

          <section id="user-management" className="scroll-mt-6">
            <AdminUserTable
              query={searchInput}
              onQueryChange={setSearchInput}
              onSearch={handleSearch}
              users={usersQuery.data ?? []}
              selectedUserId={selectedUser?.id ?? null}
              onSelectUser={handleSelectUser}
              isLoading={usersQuery.isLoading}
              isFetching={usersQuery.isFetching}
            />
          </section>

          <section id="subscription-overrides" className="scroll-mt-6">
            <OverrideControls
              selectedUser={selectedAccess?.user ?? selectedUser}
              effectiveAccess={selectedAccess}
              isLoading={effectiveAccessQuery.isLoading}
              reason={reason}
              onReasonChange={setReason}
              expiresAtLocal={expiresAtLocal}
              onExpiresAtChange={setExpiresAtLocal}
              onRequestSetPlan={openSetPlanConfirmation}
              onRequestRemoveOverride={openRemoveConfirmation}
              isSettingOverride={setOverrideMutation.isPending}
              isRemovingOverride={removeOverrideMutation.isPending}
            />
          </section>

          <section id="system-monitoring" className="scroll-mt-6">
            <Card className="border-border/70 shadow-sm">
              <CardContent className="space-y-5 p-6">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">System Monitoring</h2>
                    <p className="text-sm text-muted-foreground">Basic operational status for the admin surface.</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Access Control</div>
                    <div className="mt-2 text-lg font-semibold">Server enforced</div>
                    <p className="mt-1 text-sm text-muted-foreground">Admin role checks and IP allowlisting are enforced before every admin route.</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">API Budget</div>
                    <div className="mt-2 text-lg font-semibold">60 req/min</div>
                    <p className="mt-1 text-sm text-muted-foreground">Admin endpoints are rate limited to reduce accidental abuse.</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Audit Trail</div>
                    <div className="mt-2 text-lg font-semibold">{auditLogsQuery.data?.total ?? 0} actions</div>
                    <p className="mt-1 text-sm text-muted-foreground">Override changes are written to the audit log with admin and target identifiers.</p>
                  </div>
                </div>

                {selectedAccess ? (
                  <div className="grid gap-3 rounded-2xl border border-border/70 bg-background p-4 sm:grid-cols-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Selected User</div>
                      <div className="mt-1 font-semibold">{selectedAccess.user.fullName}</div>
                      <div className="text-sm text-muted-foreground">{selectedAccess.user.email}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current Plan</div>
                      <div className="mt-1 font-semibold">{formatPlan(currentPlan)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Effective Plan</div>
                      <div className="mt-1 font-semibold">{formatPlan(effectivePlan)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    Select a user to surface live plan telemetry here.
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <section id="audit-logs" className="scroll-mt-6">
            <AuditLogTable
              items={(auditLogsQuery.data?.items ?? []) as AdminAuditLogItem[]}
              isLoading={auditLogsQuery.isLoading || auditLogsQuery.isFetching}
              total={auditLogsQuery.data?.total ?? 0}
              page={auditPage}
              pageSize={AUDIT_PAGE_SIZE}
              onPageChange={setAuditPage}
            />
          </section>
        </main>
      </div>

      <Dialog open={confirmationOpen} onOpenChange={(open) => {
        setConfirmationOpen(open);
        if (!open) {
          setPendingAction(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmationTitle}</DialogTitle>
            <DialogDescription>{confirmationDescription}</DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
            <div className="font-medium text-foreground">Reason</div>
            <div className="mt-1">{reason.trim() || "No reason provided"}</div>
            <div className="mt-3 font-medium text-foreground">Expiration</div>
            <div className="mt-1">{expiresAtLocal ? new Date(expiresAtLocal).toLocaleString() : "No expiration set"}</div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmationOpen(false);
                setPendingAction(null);
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!pendingAction) {
                  return;
                }

                if (pendingAction.kind === "remove") {
                  await removeOverrideMutation.mutateAsync();
                  return;
                }

                await setOverrideMutation.mutateAsync(pendingAction.plan);
              }}
              disabled={isSaving || !selectedUser}
            >
              {isSaving ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;