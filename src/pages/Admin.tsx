import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { adminService, type AdminUserSearchResult } from "@/services/admin.service";

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

const Admin = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUserSearchResult | null>(null);
  const [overridePlan, setOverridePlan] = useState<"FREE" | "PRO" | "ENTERPRISE">("PRO");
  const [reason, setReason] = useState("Internal QA override");
  const [expiresAtLocal, setExpiresAtLocal] = useState("");

  const searchEnabled = searchValue.trim().length >= 2;

  const usersQuery = useQuery({
    queryKey: ["admin-user-search", searchValue],
    queryFn: () => adminService.searchUsers(searchValue, 10),
    enabled: searchEnabled,
  });

  const effectiveAccessQuery = useQuery({
    queryKey: ["admin-effective-access", selectedUser?.id],
    queryFn: () => adminService.getEffectiveAccess(selectedUser!.id),
    enabled: Boolean(selectedUser?.id),
  });

  const overrideHistoryQuery = useQuery({
    queryKey: ["admin-override-history", selectedUser?.id],
    queryFn: () => adminService.getOverrideHistory(selectedUser!.id, 10),
    enabled: Boolean(selectedUser?.id),
  });

  const refreshSelectedUserData = async () => {
    if (!selectedUser?.id) {
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-effective-access", selectedUser.id] }),
      queryClient.invalidateQueries({ queryKey: ["admin-override-history", selectedUser.id] }),
    ]);
  };

  const setOverrideMutation = useMutation({
    mutationFn: (plan: "FREE" | "PRO" | "ENTERPRISE") =>
      adminService.setPlanOverride(selectedUser!.id, {
        plan,
        reason: reason.trim() || undefined,
        expiresAt: toIsoDateTime(expiresAtLocal),
      }),
    onSuccess: async () => {
      await refreshSelectedUserData();
      toast({
        title: "Override applied",
        description: `Override has been updated for ${selectedUser?.email}.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to set override",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const removeOverrideMutation = useMutation({
    mutationFn: () => adminService.removeOverride(selectedUser!.id),
    onSuccess: async () => {
      await refreshSelectedUserData();
      toast({ title: "Override removed", description: "User now follows normal subscription plan." });
    },
    onError: (error) => {
      toast({
        title: "Failed to remove override",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const selectedSummary = useMemo(() => {
    if (!effectiveAccessQuery.data) {
      return null;
    }

    const data = effectiveAccessQuery.data;
    return {
      effectivePlan: data.effectivePlan.type,
      sourceLabel: data.effectivePlan.source === "admin_override" ? "Admin override" : "Subscription",
      subscriptionPlan: data.subscriptionPlan?.type ?? "NONE",
      overrideStatus: data.override
        ? data.override.isActive
          ? "ACTIVE"
          : data.override.isExpired
          ? "EXPIRED"
          : "INACTIVE"
        : "NONE",
      overrideExpiresAt: data.override?.expiresAt ?? null,
    };
  }, [effectiveAccessQuery.data]);

  return (
    <DashboardShell
      title="Admin Panel"
      description="Internal-only tools for testing paid feature access without Stripe or billing impact."
    >
      <div className="space-y-6">
        <section className="bg-card border border-border rounded-lg p-5 space-y-4">
          <h3 className="text-lg font-semibold">User Search</h3>
          <div className="flex gap-2">
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by user email or user id"
            />
            <Button
              type="button"
              onClick={() => {
                setSearchValue(searchInput.trim());
                setSelectedUser(null);
              }}
              disabled={searchInput.trim().length < 2}
            >
              Search
            </Button>
          </div>

          {usersQuery.data && usersQuery.data.length > 0 ? (
            <div className="space-y-2">
              {usersQuery.data.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setSelectedUser(user)}
                  className={`w-full text-left rounded-md border p-3 transition-colors ${
                    selectedUser?.id === user.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <p className="font-medium">{user.fullName}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        {selectedUser ? (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <h3 className="text-lg font-semibold">Effective Access</h3>
              {effectiveAccessQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading access...</p> : null}
              {selectedSummary ? (
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">User:</span> {selectedUser.email}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Effective plan:</span> {selectedSummary.effectivePlan}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Source:</span> {selectedSummary.sourceLabel}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Subscription plan:</span> {selectedSummary.subscriptionPlan}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Override status:</span> {selectedSummary.overrideStatus}
                  </p>
                  {selectedSummary.overrideExpiresAt ? (
                    <p>
                      <span className="text-muted-foreground">Override expires:</span>{" "}
                      {new Date(selectedSummary.overrideExpiresAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <h3 className="text-lg font-semibold">Override Controls</h3>

              <div className="space-y-2">
                <Label htmlFor="override-plan">Plan</Label>
                <select
                  id="override-plan"
                  className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                  value={overridePlan}
                  onChange={(event) => setOverridePlan(event.target.value as "FREE" | "PRO" | "ENTERPRISE")}
                >
                  <option value="FREE">FREE</option>
                  <option value="PRO">PRO</option>
                  <option value="ENTERPRISE">ENTERPRISE</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="override-reason">Reason</Label>
                <Input
                  id="override-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Reason for override"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="override-expiration">Expiration (optional)</Label>
                <Input
                  id="override-expiration"
                  type="datetime-local"
                  value={expiresAtLocal}
                  onChange={(event) => setExpiresAtLocal(event.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => setOverrideMutation.mutate("PRO")}
                  disabled={setOverrideMutation.isPending}
                >
                  {setOverrideMutation.isPending ? "Setting..." : "Set PRO for user"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setOverrideMutation.mutate(overridePlan)}
                  disabled={setOverrideMutation.isPending}
                >
                  {setOverrideMutation.isPending ? "Setting..." : `Set ${overridePlan} override`}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeOverrideMutation.mutate()}
                  disabled={removeOverrideMutation.isPending}
                >
                  {removeOverrideMutation.isPending ? "Removing..." : "Remove override"}
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        {selectedUser ? (
          <section className="bg-card border border-border rounded-lg p-5 space-y-4">
            <h3 className="text-lg font-semibold">Recent Override History</h3>
            {overrideHistoryQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading history...</p> : null}
            {overrideHistoryQuery.data?.length ? (
              <div className="space-y-2">
                {overrideHistoryQuery.data.map((entry, idx) => (
                  <div key={`${entry.createdAt}-${idx}`} className="rounded-md border border-border p-3 text-sm">
                    <p>
                      <span className="text-muted-foreground">Plan:</span> {entry.plan}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Reason:</span> {entry.reason || "N/A"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Created:</span> {new Date(entry.createdAt).toLocaleString()}
                    </p>
                    <p>
                      <span className="text-muted-foreground">By:</span> {entry.createdByAdmin?.email || "Unknown admin"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Revoked:</span>{" "}
                      {entry.revokedAt ? new Date(entry.revokedAt).toLocaleString() : "Active or not revoked"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No overrides found for this user.</p>
            )}
          </section>
        ) : null}
      </div>
    </DashboardShell>
  );
};

export default Admin;
