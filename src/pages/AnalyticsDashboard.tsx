import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, LineChart, Line } from "recharts";
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

  const sentimentData = data
    ? [
        { name: "Positive", value: data.sentiment.positive, color: "#22c55e" },
        { name: "Neutral", value: data.sentiment.neutral, color: "#94a3b8" },
        { name: "Negative", value: data.sentiment.negative, color: "#ef4444" },
      ]
    : [];

  return (
    <DashboardShell title="Analytics" description="Track chatbot performance, response quality, and conversation outcomes.">
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
            <CardHeader><CardTitle className="text-base">Avg Response Time</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{isLoading ? "..." : `${data?.kpis.avgResponseTimeSeconds ?? 0}s`}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Resolution Rate</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{isLoading ? "..." : `${data?.kpis.resolutionRate ?? 0}%`}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Total Messages</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{isLoading ? "..." : data?.kpis.totalMessages ?? 0}</p></CardContent>
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
              <CardTitle>Sentiment Distribution</CardTitle>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sentimentData} dataKey="value" nameKey="name" outerRadius={110} label>
                    {sentimentData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Response Time by Conversation</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.responseTimeSeries ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line dataKey="responseTimeSeconds" stroke="#f59e0b" strokeWidth={2} dot={false} name="Response time (s)" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
