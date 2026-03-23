import { ConversationStatus, MessageRole } from "@prisma/client";
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

function normalizeText(text: string): string {
  return text.toLowerCase();
}

function estimateSentiment(messages: Array<{ content: string }>) {
  const positiveWords = ["great", "thanks", "resolved", "perfect", "awesome", "happy", "good"];
  const negativeWords = ["bad", "angry", "broken", "issue", "problem", "slow", "frustrated"];

  let positive = 0;
  let negative = 0;

  messages.forEach((message) => {
    const normalized = normalizeText(message.content);
    if (positiveWords.some((word) => normalized.includes(word))) {
      positive += 1;
    }
    if (negativeWords.some((word) => normalized.includes(word))) {
      negative += 1;
    }
  });

  const total = positive + negative;
  const neutral = Math.max(messages.length - total, 0);

  const toPercent = (value: number) => (messages.length ? Number(((value / messages.length) * 100).toFixed(2)) : 0);

  return {
    positive: toPercent(positive),
    neutral: toPercent(neutral),
    negative: toPercent(negative),
  };
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
        status: true,
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
          avgResponseTimeSeconds: 0,
          resolutionRate: 0,
          totalMessages: 0,
        },
        messageVolume: [],
        responseTimeSeries: [],
        sentiment: { positive: 0, neutral: 0, negative: 0 },
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
        content: true,
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

    const responseTimeValues = Array.from(responseTimesByConversation.values());
    const avgResponseTimeSeconds =
      responseTimeValues.length > 0
        ? Number((responseTimeValues.reduce((sum, value) => sum + value, 0) / responseTimeValues.length).toFixed(2))
        : 0;

    const resolvedCount = conversations.filter((conversation) => conversation.status === ConversationStatus.ENDED).length;
    const resolutionRate = Number(((resolvedCount / conversations.length) * 100).toFixed(2));

    const messageVolumeMap = new Map<string, { userMessages: number; assistantMessages: number }>();
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
    });

    const messageVolume = Array.from(messageVolumeMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, counts]) => ({
        date,
        userMessages: counts.userMessages,
        assistantMessages: counts.assistantMessages,
        totalMessages: counts.userMessages + counts.assistantMessages,
      }));

    const responseTimeSeries = conversations.map((conversation) => ({
      conversationId: conversation.id,
      date: dayKey(conversation.createdAt),
      responseTimeSeconds: Number((responseTimesByConversation.get(conversation.id) ?? 0).toFixed(2)),
    }));

    const sentiment = estimateSentiment(messages.filter((message) => message.role !== MessageRole.SYSTEM));

    return {
      filters: query,
      kpis: {
        conversationsCount: conversations.length,
        avgResponseTimeSeconds,
        resolutionRate,
        totalMessages: messages.length,
      },
      messageVolume,
      responseTimeSeries,
      sentiment,
    };
  }
}
