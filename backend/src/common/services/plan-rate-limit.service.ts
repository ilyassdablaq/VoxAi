import { PlanType } from "@prisma/client";
import { redis } from "../../infra/cache/redis.js";
import { logger } from "../../config/logger.js";

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  tokensPerDay: number;
  voiceMinutesPerDay: number;
}

const PLAN_RATE_LIMITS: Record<PlanType, RateLimitConfig> = {
  FREE: {
    requestsPerMinute: 10,
    requestsPerHour: 100,
    requestsPerDay: 500,
    tokensPerDay: 10000,
    voiceMinutesPerDay: 5,
  },
  PRO: {
    requestsPerMinute: 100,
    requestsPerHour: 1000,
    requestsPerDay: 10000,
    tokensPerDay: 500000,
    voiceMinutesPerDay: 500,
  },
  ENTERPRISE: {
    requestsPerMinute: 1000,
    requestsPerHour: 50000,
    requestsPerDay: 1000000,
    tokensPerDay: 100000000,
    voiceMinutesPerDay: 100000,
  },
};

class RateLimitService {
  getConfigForPlan(planType: PlanType): RateLimitConfig {
    return PLAN_RATE_LIMITS[planType] || PLAN_RATE_LIMITS.FREE;
  }

  async checkRequestLimit(principal: string, planType: PlanType, window: "minute" | "hour" | "day"): Promise<boolean> {
    const config = this.getConfigForPlan(planType);
    const limitKey = `requestsPer${window.charAt(0).toUpperCase()}${window.slice(1)}` as keyof RateLimitConfig;
    const limit = config[limitKey] as number;
    const key = `rate-limit:${principal}:requests:${window}`;
    const ttl = window === "minute" ? 60 : window === "hour" ? 3600 : 86400;

    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, ttl);
    }

    return current <= limit;
  }

  async checkTokenLimit(userId: string, planType: PlanType, tokensToUse: number): Promise<boolean> {
    const config = this.getConfigForPlan(planType);
    const key = `rate-limit:${userId}:tokens:day`;

    const current = await redis.incrby(key, tokensToUse);
    if (current === tokensToUse) {
      await redis.expire(key, 86400); // 24 hours
    }

    return current <= config.tokensPerDay;
  }

  async checkVoiceMinuteLimit(userId: string, planType: PlanType, minutesToUse: number): Promise<boolean> {
    const config = this.getConfigForPlan(planType);
    const key = `rate-limit:${userId}:voice:day`;

    const currentRaw = await redis.incrbyfloat(key, minutesToUse);
    const current = typeof currentRaw === "string" ? Number(currentRaw) : currentRaw;

    if (current <= minutesToUse) {
      await redis.expire(key, 86400); // 24 hours
    }

    return current <= config.voiceMinutesPerDay;
  }

  async getRemainingRequests(principal: string, planType: PlanType, window: "minute" | "hour" | "day"): Promise<number> {
    const config = this.getConfigForPlan(planType);
    const limitKey = `requestsPer${window.charAt(0).toUpperCase()}${window.slice(1)}` as keyof RateLimitConfig;
    const limit = config[limitKey] as number;
    const key = `rate-limit:${principal}:requests:${window}`;

    const current = await redis.get(key);
    return Math.max(0, limit - (parseInt(current || "0") || 0));
  }

  async getRemainingTokens(userId: string, planType: PlanType): Promise<number> {
    const config = this.getConfigForPlan(planType);
    const key = `rate-limit:${userId}:tokens:day`;

    const current = await redis.get(key);
    return Math.max(0, config.tokensPerDay - (parseInt(current || "0") || 0));
  }

  async resetDaily(principal: string): Promise<void> {
    const keys = await redis.keys(`rate-limit:${principal}:*:day`);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info({ principal, keysReset: keys.length }, "Daily rate limit reset");
    }
  }
}

export const rateLimitService = new RateLimitService();
