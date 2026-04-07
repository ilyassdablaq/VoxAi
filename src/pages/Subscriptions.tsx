import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, CreditCard, Loader2, Lock, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { PaymentMethodOption, subscriptionService } from "@/services/subscription.service";

const fallbackPaymentMethods: PaymentMethodOption[] = [
  {
    key: "card",
    label: "Credit / Debit Cards",
    description: "Visa, Mastercard, American Express and other major cards.",
    enabled: true,
  },
  {
    key: "paypal",
    label: "PayPal",
    description: "Available where Stripe account and region support it.",
    enabled: true,
  },
  {
    key: "wallets",
    label: "Apple Pay / Google Pay",
    description: "Shown automatically on supported devices and browsers.",
    enabled: true,
  },
  {
    key: "sepa_debit",
    label: "SEPA Direct Debit",
    description: "Available for eligible EU customers and EUR billing setups.",
    enabled: true,
  },
];

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
    priceCents: 9900,
    voiceMinutes: 2000,
    tokenLimit: 10000000,
    features: ["Custom SLAs", "Advanced analytics", "Dedicated success manager"],
  },
];

function formatEuroFromCents(priceCents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(priceCents / 100);
}

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
  const [searchParams] = useSearchParams();
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

  const { data: checkoutCapabilities } = useQuery({
    queryKey: ["checkout-capabilities"],
    queryFn: () => subscriptionService.getCheckoutCapabilities(),
  });

  const currentPlanKey = currentSubscription?.plan?.toLowerCase();

  useEffect(() => {
    const paymentState = searchParams.get("payment");
    if (!paymentState) {
      return;
    }

    if (paymentState === "cancelled") {
      toast({
        title: "Checkout canceled",
        description: "No payment was made. Your current plan is unchanged.",
      });
    }

    navigate("/dashboard/subscriptions", { replace: true });
  }, [searchParams, toast, navigate]);

  const upgradeMutation = useMutation({
    mutationFn: (planKey: string) => subscriptionService.startUpgrade(planKey),
    onSuccess: async (result, planKey) => {
      if (planKey === "free" || result.mode === "direct") {
        await queryClient.invalidateQueries({ queryKey: ["current-subscription"] });
        await queryClient.invalidateQueries({ queryKey: ["plans"] });
        toast({
          title: "Plan updated",
          description: "Your account is now on the Free plan.",
        });
        return;
      }

      if (result.url) {
        window.location.href = result.url;
        return;
      }

      toast({
        title: "Upgrade failed",
        description: "Checkout URL could not be created.",
        variant: "destructive",
      });
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

  const currentPlanDetails = useMemo(
    () => sortedPlans.find((plan) => plan.key === currentPlanKey),
    [sortedPlans, currentPlanKey],
  );

  const paymentMethods = useMemo(() => {
    const apiMethods = checkoutCapabilities?.paymentMethods;
    const source = apiMethods && apiMethods.length > 0 ? apiMethods : fallbackPaymentMethods;
    return source.filter((method) => method.enabled);
  }, [checkoutCapabilities]);

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
              <div className="space-y-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{currentPlanDetails?.name ?? currentSubscription.plan}</p>
                    {currentPlanDetails ? (
                      <p className="text-sm text-muted-foreground">
                        {currentPlanDetails.voiceMinutes} voice minutes • {currentPlanDetails.tokenLimit.toLocaleString()} tokens/month
                      </p>
                    ) : null}
                    {currentSubscription.isOverride ? (
                      <p className="text-xs text-amber-700 mt-1">
                        Effective access is currently {currentSubscription.effectivePlan}
                        {currentSubscription.overrideExpiresAt ? ` until ${new Date(currentSubscription.overrideExpiresAt).toLocaleString("de-DE")}` : " via admin override"}.
                      </p>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">Billing is processed securely through Stripe checkout.</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active subscription yet. Select a plan below.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Payment Methods & Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
              {paymentMethods.map((method) => (
                <div key={method.key} className="rounded-lg border p-3">
                  <p className="font-medium text-sm">{method.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{method.description}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" />
                  Encrypted Transactions
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Checkout uses HTTPS and Stripe-hosted payment forms so card details never touch your app server.
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Reliable Billing Status
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Subscription status is updated from Stripe webhook events for successful and failed payments.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                    {formatEuroFromCents(plan.priceCents)}
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
                    className="w-full min-h-11"
                    variant={isCurrent ? "secondary" : "default"}
                    disabled={isCurrent || upgradeMutation.isPending}
                    onClick={() => upgradeMutation.mutate(plan.key)}
                  >
                    {upgradeMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Processing...
                      </>
                    ) : isCurrent ? (
                      "Current Plan"
                    ) : (
                      <>
                        Upgrade
                        <span className="hidden sm:inline"> to {plan.name}</span>
                      </>
                    )}
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
