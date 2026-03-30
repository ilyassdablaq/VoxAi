import { apiClient } from "@/lib/api-client";

export interface Plan {
  id: string;
  key: string;
  name: string;
  type: 'FREE' | 'PRO' | 'ENTERPRISE';
  interval: "MONTHLY" | "YEARLY";
  priceCents: number;
  voiceMinutes: number;
  tokenLimit: number;
  features: Record<string, unknown>;
}

export interface CurrentSubscription {
  id: string;
  userId: string;
  planId: string;
  status: "ACTIVE" | "INACTIVE" | "CANCELED" | "EXPIRED";
  startsAt: string;
  endsAt: string | null;
  plan: Plan;
}

export interface PaymentMethodOption {
  key: "card" | "paypal" | "wallets" | "sepa_debit";
  label: string;
  description: string;
  enabled: boolean;
}

export interface CheckoutCapabilities {
  paymentMethods: PaymentMethodOption[];
}

export interface UpgradeResponse {
  sessionId: string;
  url: string | null;
  mode?: "checkout" | "direct";
}

export const subscriptionService = {
  listPlans(): Promise<Plan[]> {
    return apiClient.get<Plan[]>("/api/plans");
  },

  getAvailablePlans(): Promise<Plan[]> {
    return apiClient.get<Plan[]>("/api/subscriptions/available");
  },

  getCheckoutCapabilities(): Promise<CheckoutCapabilities> {
    return apiClient.get<CheckoutCapabilities>("/api/subscriptions/payment-methods");
  },

  getCurrentSubscription(): Promise<CurrentSubscription> {
    return apiClient.get<CurrentSubscription>("/api/subscriptions/current");
  },

  changePlan(planKey: string): Promise<CurrentSubscription> {
    return apiClient.post<CurrentSubscription>("/api/subscriptions/change", { planKey });
  },

  cancelToFreePlan(): Promise<CurrentSubscription> {
    return apiClient.post<CurrentSubscription>("/api/subscriptions/cancel", {});
  },

  async startUpgrade(planKey: string): Promise<UpgradeResponse> {
    return apiClient.post<UpgradeResponse>(
      "/api/subscriptions/upgrade",
      { planKey }
    );
  },
};
