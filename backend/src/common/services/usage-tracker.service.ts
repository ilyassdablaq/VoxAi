import { prisma } from "../../infra/database/prisma.js";
import { redis } from "../../infra/cache/redis.js";
import { logger } from "../../config/logger.js";
import { rateLimitService } from "./plan-rate-limit.service.js";
import { auditLogService } from "./audit-log.service.js";
import type { PlanType } from "@prisma/client";

type UsageSource =
  | "ws.text"
  | "ws.voice"
  | "api.completion"
  | "api.embedding"
  | "rag.ingest";

interface UsageRecord {
  userId: string;
  conversationId?: string;
  tokensUsed: number;
  minutesUsed: number;
  source: UsageSource;
  model?: string;
  costMicroCents?: number; // optional cost-tracking (1/100_000 cent)
}

const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_BATCH_KEY = "usage:flush:queue";

class UsageTrackerService {
  private buffer: UsageRecord[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  async record(record: UsageRecord, planType: PlanType = "FREE"): Promise<void> {
    // 1. Enforce token & voice-minute limits in Redis (fast path)
    if (record.tokensUsed > 0) {
      const tokenAllowed = await rateLimitService.checkTokenLimit(
        record.userId,
        planType,
        record.tokensUsed,
      );
      if (!tokenAllowed) {
        logger.warn({ userId: record.userId, planType }, "Token limit exceeded");
      }
    }
    if (record.minutesUsed > 0) {
      const voiceAllowed = await rateLimitService.checkVoiceMinuteLimit(
        record.userId,
        planType,
        record.minutesUsed,
      );
      if (!voiceAllowed) {
        logger.warn({ userId: record.userId, planType }, "Voice-minutes limit exceeded");
      }
    }

    // 2. Update spend-cap counter (best-effort, in BigInt-cents)
    if (record.costMicroCents && record.costMicroCents > 0) {
      try {
        await this.incrementSpendCap(record.userId, record.costMicroCents);
      } catch (error) {
        logger.warn({ error }, "spend-cap increment failed");
      }
    }

    // 3. Buffer DB-write (batched flush every 5s, flushed on limit)
    this.buffer.push(record);
    if (this.buffer.length >= 50) {
      await this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => void this.flush(), FLUSH_INTERVAL_MS);
    }
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, this.buffer.length);

    try {
      await prisma.usage.createMany({
        data: batch.map((r) => ({
          userId: r.userId,
          conversationId: r.conversationId,
          tokensUsed: r.tokensUsed,
          minutesUsed: r.minutesUsed,
        })),
      });
    } catch (error) {
      logger.error({ error, count: batch.length }, "Usage flush failed; retrying via Redis DLQ");
      try {
        await redis.rpush(FLUSH_BATCH_KEY, ...batch.map((r) => JSON.stringify(r)));
      } catch (redisError) {
        logger.error({ redisError }, "Usage DLQ push failed; data lost");
      }
    }
  }

  private async incrementSpendCap(userId: string, microCents: number): Promise<void> {
    const incrementCents = Math.ceil(microCents / 100_000);
    if (incrementCents <= 0) return;

    const cap = await prisma.spendCap.findUnique({ where: { tenantId: userId } });
    if (!cap) return;

    const newSpend = cap.currentMonthSpendCents + BigInt(incrementCents);
    const ratio = Number(newSpend) / Number(cap.monthlyBudgetCents);

    await prisma.spendCap.update({
      where: { tenantId: userId },
      data: { currentMonthSpendCents: newSpend },
    });

    if (ratio >= 1.0 && cap.hardLimitEnabled) {
      await auditLogService.log({
        principalType: "system",
        principalId: "spend-cap",
        userId,
        action: "billing.spend_cap.exceeded",
        resourceType: "user",
        resourceId: userId,
        status: "failure",
        changes: { ratio, newSpend: newSpend.toString(), budget: cap.monthlyBudgetCents.toString() },
      });
    } else if (ratio >= cap.warningThresholdPercent / 100) {
      await auditLogService.log({
        principalType: "system",
        principalId: "spend-cap",
        userId,
        action: "billing.spend_cap.warning",
        resourceType: "user",
        resourceId: userId,
        changes: { ratio },
      });
    }
  }

  async drainPersistentDlq(): Promise<number> {
    let drained = 0;
    while (true) {
      const item = await redis.lpop(FLUSH_BATCH_KEY);
      if (!item) break;
      try {
        const parsed = JSON.parse(item) as UsageRecord;
        await prisma.usage.create({
          data: {
            userId: parsed.userId,
            conversationId: parsed.conversationId,
            tokensUsed: parsed.tokensUsed,
            minutesUsed: parsed.minutesUsed,
          },
        });
        drained++;
      } catch (error) {
        logger.error({ error }, "DLQ drain item failed; re-enqueuing");
        await redis.rpush(FLUSH_BATCH_KEY, item);
        break;
      }
    }
    return drained;
  }
}

export const usageTracker = new UsageTrackerService();
