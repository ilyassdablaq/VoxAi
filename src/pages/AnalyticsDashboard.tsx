import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, LineChart, Line } from "recharts";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyticsService, AnalyticsRange } from "@/services/analytics.service";

const RANGES: AnalyticsRange[] = ["7d", "30d", "90d", "365d"];

export default function AnalyticsDashboard() {
  const [range, setRange] = useState<AnalyticsRange>("30d");

  const { data, isLoading } = useQuery({
    queryKey: ["analytics-dashboard", range],
    queryFn: () => analyticsService.getDashboard(range),
  });

  return (
    <DashboardShell title="Analytics" description="Usage and performance insights for your conversations.">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <select
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              value={range}
              onChange={(event) => setRange(event.target.value as AnalyticsRange)}
            >
              {RANGES.map((item) => (
                <option key={item} value={item}>
                  Last {item.replace("d", " days")}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Conversations</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{isLoading ? "..." : data?.kpis.conversationsCount ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Message Volume</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{isLoading ? "..." : data?.kpis.totalMessages ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Token Usage</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{isLoading ? "..." : data?.kpis.totalTokens ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Latency (avg / p95)</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{isLoading ? "..." : `${data?.kpis.avgResponseTimeSeconds ?? 0}s`}</p>
              <p className="text-xs text-muted-foreground mt-1">{isLoading ? "" : `P95: ${data?.kpis.p95ResponseTimeSeconds ?? 0}s`}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Message Volume Over Time</CardTitle>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.messageVolume ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="userMessages" fill="#6366f1" name="User" />
                  <Bar dataKey="assistantMessages" fill="#10b981" name="Assistant" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Token Usage Over Time</CardTitle>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.tokenUsageByDay ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line dataKey="totalTokens" stroke="#6366f1" strokeWidth={2} dot={false} name="Tokens" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Response Latency Over Time</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.latencyByDay ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line dataKey="avgResponseTimeSeconds" stroke="#f59e0b" strokeWidth={2} dot={false} name="Avg latency (s)" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Conversations by Token Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data?.conversationUsage ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No conversation usage data in this range.</p>
              ) : (
                (data?.conversationUsage ?? []).map((conversation) => (
                  <div key={conversation.conversationId} className="flex items-center justify-between border border-border rounded-md px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{conversation.conversationTitle || `Conversation ${conversation.conversationId.slice(0, 8)}`}</p>
                      <p className="text-xs text-muted-foreground">{conversation.totalMessages} messages</p>
                    </div>
                    <p className="text-sm font-semibold">{conversation.totalTokens} tokens</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
