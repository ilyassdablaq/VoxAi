import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { subscriptionService } from "@/services/subscription.service";

const fallbackPlans = [
  {
    id: "fallback-free",
    key: "free",
    name: "Free",
    interval: "MONTHLY" as const,
    priceCents: 0,
    voiceMinutes: 30,
    tokenLimit: 15000,
    features: ["Basic web widget", "Community support"],
  },
  {
    id: "fallback-pro",
    key: "pro",
    name: "Pro",
    interval: "MONTHLY" as const,
    priceCents: 4900,
    voiceMinutes: 300,
    tokenLimit: 250000,
    features: ["Voice support", "API access", "Priority email support"],
  },
  {
    id: "fallback-enterprise",
    key: "enterprise",
    name: "Enterprise",
    interval: "MONTHLY" as const,
    priceCents: 19900,
    voiceMinutes: 2000,
    tokenLimit: 2000000,
    features: ["Custom SLAs", "Advanced analytics", "Dedicated success manager"],
  },
];

function normalizeFeatures(features: unknown): string[] {
  if (Array.isArray(features)) {
    return features.map((feature) => String(feature));
  }

  if (features && typeof features === "object") {
    return Object.entries(features as Record<string, unknown>).map(([key, value]) => `${key}: ${String(value)}`);
  }

  return [];
}

export default function Subscriptions() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { subscription } = useAuth();

  const { data: plans = [], isLoading: isPlansLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: () => subscriptionService.listPlans(),
  });

  const { data: currentSubscription, isLoading: isCurrentLoading } = useQuery({
    queryKey: ["current-subscription"],
    queryFn: () => subscriptionService.getCurrentSubscription(),
  });

  const currentPlanKey = currentSubscription?.plan?.key;

  const upgradeMutation = useMutation({
    mutationFn: (planKey: string) => subscriptionService.startUpgrade(planKey),
    onSuccess: (checkoutUrl) => {
      window.location.href = checkoutUrl;
    },
    onError: (error) => {
      toast({
        title: "Upgrade failed",
        description: error instanceof Error ? error.message : "Unable to start upgrade",
        variant: "destructive",
      });
    },
  });

  const sortedPlans = useMemo(() => {
    const sourcePlans = plans.length > 0 ? plans : fallbackPlans;
    return [...sourcePlans].sort((a, b) => a.priceCents - b.priceCents);
  }, [plans]);

  return (
    <DashboardShell title="Subscriptions" description="Manage your plan, usage capacity, and billing readiness.">
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
          </CardHeader>
          <CardContent>
            {isCurrentLoading ? (
              <Skeleton className="h-14 w-full" />
            ) : currentSubscription ? (
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{currentSubscription.plan.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {currentSubscription.plan.voiceMinutes} voice minutes • {currentSubscription.plan.tokenLimit.toLocaleString()} tokens/month
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">Billing integration is Stripe-ready (mocked for now).</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active subscription yet. Select a plan below.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          {(isPlansLoading ? [0, 1, 2] : sortedPlans).map((planOrSkeleton, index) => {
            if (isPlansLoading) {
              return (
                <Card key={`plan-skeleton-${index}`}>
                  <CardHeader>
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-5 w-2/3" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </CardContent>
                </Card>
              );
            }

            const plan = planOrSkeleton;
            const isCurrent = currentPlanKey === plan.key;

            return (
              <Card key={plan.id} className={isCurrent ? "border-primary" : undefined}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{plan.name}</CardTitle>
                    {isCurrent ? <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">Current Plan</span> : null}
                  </div>
                  <p className="text-3xl font-bold">
                    ${(plan.priceCents / 100).toFixed(0)}
                    <span className="text-sm text-muted-foreground font-normal">/{plan.interval === "MONTHLY" ? "mo" : "yr"}</span>
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" />{plan.voiceMinutes} voice minutes</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" />{plan.tokenLimit.toLocaleString()} AI tokens/month</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" />API access and web integrations</li>
                    {normalizeFeatures(plan.features).slice(0, 2).map((feature) => (
                      <li key={feature} className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" />{feature}</li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={isCurrent ? "secondary" : "default"}
                    disabled={isCurrent || upgradeMutation.isPending}
                    onClick={() => upgradeMutation.mutate(plan.key)}
                  >
                    {upgradeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isCurrent ? "Current Plan" : "Upgrade to " + plan.name}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}
