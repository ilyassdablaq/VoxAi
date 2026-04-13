import { AlertCircle, Crown, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { EffectiveAccessResponse } from "@/services/admin.service";

interface OverrideControlsProps {
  selectedUser: EffectiveAccessResponse["user"] | null;
  effectiveAccess: EffectiveAccessResponse | null;
  isLoading: boolean;
  reason: string;
  onReasonChange: (value: string) => void;
  expiresAtLocal: string;
  onExpiresAtChange: (value: string) => void;
  onRequestSetPlan: (plan: "FREE" | "PRO") => void;
  onRequestRemoveOverride: () => void;
  isSettingOverride: boolean;
  isRemovingOverride: boolean;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "None";
  }

  return new Date(value).toLocaleString();
}

export function OverrideControls({
  selectedUser,
  effectiveAccess,
  isLoading,
  reason,
  onReasonChange,
  expiresAtLocal,
  onExpiresAtChange,
  onRequestSetPlan,
  onRequestRemoveOverride,
  isSettingOverride,
  isRemovingOverride,
}: OverrideControlsProps) {
  const currentPlan = effectiveAccess?.subscriptionPlan?.type ?? "FREE";
  const effectivePlan = effectiveAccess?.effectivePlan.type ?? "FREE";
  const override = effectiveAccess?.override;

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Crown className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl">Subscription Overrides</CardTitle>
            <CardDescription>Apply or remove temporary plan access for the selected user.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {!selectedUser ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/30 p-6 text-sm text-muted-foreground">
            Select a user to manage override access.
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current Plan</div>
                <div className="mt-2 text-lg font-semibold">{currentPlan}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Effective Plan</div>
                <div className="mt-2 text-lg font-semibold">{effectivePlan}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Override Status</div>
                <div className="mt-2 flex items-center gap-2 text-lg font-semibold">
                  {override ? override.isActive ? "Active" : override.isExpired ? "Expired" : "Inactive" : "None"}
                  <Badge variant={override?.isActive ? "default" : "outline"}>{override?.plan ?? "FREE"}</Badge>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="admin-override-reason">Reason</Label>
                <Input
                  id="admin-override-reason"
                  value={reason}
                  onChange={(event) => onReasonChange(event.target.value)}
                  placeholder="Internal QA, customer support, etc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-override-expires">Expiration date</Label>
                <Input
                  id="admin-override-expires"
                  type="datetime-local"
                  value={expiresAtLocal}
                  onChange={(event) => onExpiresAtChange(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Button type="button" onClick={() => onRequestSetPlan("PRO")} disabled={isSettingOverride} className="gap-2">
                <Crown className="h-4 w-4" />
                {isSettingOverride ? "Saving..." : "Set PRO"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => onRequestSetPlan("FREE")} disabled={isSettingOverride}>
                {isSettingOverride ? "Saving..." : "Set FREE"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onRequestRemoveOverride}
                disabled={isRemovingOverride || !override}
                className="gap-2"
              >
                <ShieldOff className="h-4 w-4" />
                {isRemovingOverride ? "Removing..." : "Remove Override"}
              </Button>
            </div>

            {!override ? (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-800 dark:text-amber-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                No active override exists for this user. Removing will be blocked until an override is present.
              </div>
            ) : (
              <div className="grid gap-2 rounded-xl border border-border/70 bg-muted/20 p-4 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">Expires:</span> {formatDateTime(override.expiresAt)}
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span> {formatDateTime(override.createdAt)}
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">Reason:</span> {override.reason || "No reason recorded"}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}