import { MessageRole } from "@prisma/client";
import { prisma } from "../../infra/database/prisma.js";
import { AnalyticsQueryInput } from "./analytics.schemas.js";

function parseRange(range: AnalyticsQueryInput["range"]): Date {
  const now = new Date();
  const start = new Date(now);

  switch (range) {
    case "7d":
      start.setDate(now.getDate() - 7);
      return start;
    case "30d":
      start.setDate(now.getDate() - 30);
      return start;
    case "90d":
      start.setDate(now.getDate() - 90);
      return start;
    case "365d":
      start.setDate(now.getDate() - 365);
      return start;
    default:
      start.setDate(now.getDate() - 30);
      return start;
  }
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function roundTo2(value: number): number {
  return Number(value.toFixed(2));
}

function percentile(values: number[], quantile: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(quantile * sorted.length) - 1));
  return sorted[index];
}

export class AnalyticsService {
  async getDashboardAnalytics(userId: string, query: AnalyticsQueryInput) {
    const startDate = parseRange(query.range);

    const conversations = await prisma.conversation.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate,
        },
        ...(query.conversationId ? { id: query.conversationId } : {}),
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const conversationIds = conversations.map((conversation) => conversation.id);

    if (conversationIds.length === 0) {
      return {
        filters: query,
        kpis: {
          conversationsCount: 0,
          totalMessages: 0,
          totalTokens: 0,
          avgResponseTimeSeconds: 0,
          p95ResponseTimeSeconds: 0,
        },
        messageVolume: [],
        tokenUsageByDay: [],
        latencyByDay: [],
        conversationUsage: [],
      };
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId: {
          in: conversationIds,
        },
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        conversationId: true,
        role: true,
        tokenCount: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const responseTimesByConversation = new Map<string, number>();
    const firstUserMessageByConversation = new Map<string, Date>();

    messages.forEach((message) => {
      if (message.role === MessageRole.USER && !firstUserMessageByConversation.has(message.conversationId)) {
        firstUserMessageByConversation.set(message.conversationId, message.createdAt);
      }

      if (
        message.role === MessageRole.ASSISTANT &&
        firstUserMessageByConversation.has(message.conversationId) &&
        !responseTimesByConversation.has(message.conversationId)
      ) {
        const firstUserDate = firstUserMessageByConversation.get(message.conversationId) as Date;
        const seconds = Math.max((message.createdAt.getTime() - firstUserDate.getTime()) / 1000, 0);
        responseTimesByConversation.set(message.conversationId, seconds);
      }
    });

    const responseTimeValues = Array.from(responseTimesByConversation.values()).map(roundTo2);
    const avgResponseTimeSeconds =
      responseTimeValues.length > 0
        ? roundTo2(responseTimeValues.reduce((sum, value) => sum + value, 0) / responseTimeValues.length)
        : 0;
    const p95ResponseTimeSeconds = roundTo2(percentile(responseTimeValues, 0.95));

    const messageVolumeMap = new Map<string, { userMessages: number; assistantMessages: number }>();
    const tokenUsageMap = new Map<string, number>();
    const conversationUsageMap = new Map<string, { totalMessages: number; totalTokens: number }>();

    messages.forEach((message) => {
      const key = dayKey(message.createdAt);
      const current = messageVolumeMap.get(key) ?? { userMessages: 0, assistantMessages: 0 };
      if (message.role === MessageRole.USER) {
        current.userMessages += 1;
      }
      if (message.role === MessageRole.ASSISTANT) {
        current.assistantMessages += 1;
      }

      messageVolumeMap.set(key, current);

      const tokenCount = message.tokenCount ?? 0;
      tokenUsageMap.set(key, (tokenUsageMap.get(key) ?? 0) + tokenCount);

      const conversationUsage = conversationUsageMap.get(message.conversationId) ?? { totalMessages: 0, totalTokens: 0 };
      conversationUsage.totalMessages += 1;
      conversationUsage.totalTokens += tokenCount;
      conversationUsageMap.set(message.conversationId, conversationUsage);
    });

    const messageVolume = Array.from(messageVolumeMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, counts]) => ({
        date,
        userMessages: counts.userMessages,
        assistantMessages: counts.assistantMessages,
        totalMessages: counts.userMessages + counts.assistantMessages,
      }));

    const tokenUsageByDay = Array.from(tokenUsageMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, totalTokens]) => ({
        date,
        totalTokens,
      }));

    const latencyByDayMap = new Map<string, number[]>();
    conversations.forEach((conversation) => {
      const responseTime = responseTimesByConversation.get(conversation.id);
      if (typeof responseTime !== "number") {
        return;
      }

      const date = dayKey(conversation.createdAt);
      const values = latencyByDayMap.get(date) ?? [];
      values.push(responseTime);
      latencyByDayMap.set(date, values);
    });

    const latencyByDay = Array.from(latencyByDayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, values]) => ({
        date,
        avgResponseTimeSeconds: roundTo2(values.reduce((sum, value) => sum + value, 0) / values.length),
      }));

    const totalTokens = messages.reduce((sum, message) => sum + (message.tokenCount ?? 0), 0);
    const conversationById = new Map(conversations.map((conversation) => [conversation.id, conversation]));
    const conversationUsage = Array.from(conversationUsageMap.entries())
      .map(([conversationId, usage]) => ({
        conversationId,
        conversationTitle: conversationById.get(conversationId)?.title ?? null,
        totalMessages: usage.totalMessages,
        totalTokens: usage.totalTokens,
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens)
      .slice(0, 10);

    return {
      filters: query,
      kpis: {
        conversationsCount: conversations.length,
        totalMessages: messages.length,
        totalTokens,
        avgResponseTimeSeconds,
        p95ResponseTimeSeconds,
      },
      messageVolume,
      tokenUsageByDay,
      latencyByDay,
      conversationUsage,
    };
  }
}
