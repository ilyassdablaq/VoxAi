import { apiClient } from "@/lib/api-client";

export type AnalyticsRange = "7d" | "30d" | "90d" | "365d";

export interface AnalyticsDashboardData {
  filters: {
    range: AnalyticsRange;
    conversationId?: string;
  };
  kpis: {
    conversationsCount: number;
    avgResponseTimeSeconds: number;
    resolutionRate: number;
    totalMessages: number;
  };
  messageVolume: Array<{
    date: string;
    userMessages: number;
    assistantMessages: number;
    totalMessages: number;
  }>;
  responseTimeSeries: Array<{
    conversationId: string;
    date: string;
    responseTimeSeconds: number;
  }>;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
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
