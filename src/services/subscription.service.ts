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

export const subscriptionService = {
  listPlans(): Promise<Plan[]> {
    return apiClient.get<Plan[]>("/api/plans");
  },

  getAvailablePlans(): Promise<Plan[]> {
    return apiClient.get<Plan[]>("/api/subscriptions/available");
  },

  getCurrentSubscription(): Promise<CurrentSubscription> {
    return apiClient.get<CurrentSubscription>("/api/subscriptions/current");
  },

  changePlan(planKey: string): Promise<CurrentSubscription> {
    return apiClient.post<CurrentSubscription>("/api/subscriptions/change", { planKey });
  },

  async startUpgrade(planKey: string): Promise<string> {
    const response = await apiClient.post<{ sessionId: string; url: string }>(
      "/api/subscriptions/upgrade",
      { planKey }
    );
    return response.url;
  },
};
