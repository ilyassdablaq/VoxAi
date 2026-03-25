import { apiClient } from "@/lib/api-client";

export type AnalyticsRange = "7d" | "30d" | "90d" | "365d";

export interface AnalyticsDashboardData {
  filters: {
    range: AnalyticsRange;
    conversationId?: string;
  };
  kpis: {
    conversationsCount: number;
    totalMessages: number;
    totalTokens: number;
    avgResponseTimeSeconds: number;
    p95ResponseTimeSeconds: number;
  };
  messageVolume: Array<{
    date: string;
    userMessages: number;
    assistantMessages: number;
    totalMessages: number;
  }>;
  tokenUsageByDay: Array<{
    date: string;
    totalTokens: number;
  }>;
  latencyByDay: Array<{
    date: string;
    avgResponseTimeSeconds: number;
  }>;
  conversationUsage: Array<{
    conversationId: string;
    conversationTitle: string | null;
    totalMessages: number;
    totalTokens: number;
  }>;
}

export const analyticsService = {
  getDashboard(range: AnalyticsRange, conversationId?: string): Promise<AnalyticsDashboardData> {
    const params = new URLSearchParams({ range });
    if (conversationId) {
      params.set("conversationId", conversationId);
    }

    return apiClient.get<AnalyticsDashboardData>(`/api/analytics/dashboard?${params.toString()}`);
  },
};
