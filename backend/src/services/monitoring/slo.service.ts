import { PrismaClient } from "@prisma/client";
import { logger } from "../../config/logger.js";

export interface SLODefinition {
  name: string;
  target: number; // 0-1, e.g., 0.99 for 99%
  window: "1h" | "24h" | "7d" | "30d";
  description: string;
}

export interface SLOMetricInput {
  metricName: string;
  tenantId?: string;
  currentValue: number;
  sloTarget: number;
}

const SLO_DEFINITIONS: Record<string, SLODefinition> = {
  chatLatencyP95: {
    name: "chat_latency_p95",
    target: 0.95, // 95% of requests < 2s
    window: "24h",
    description: "Chat response time p95 < 2000ms",
  },
  successRate: {
    name: "success_rate",
    target: 0.99, // 99% success rate
    window: "24h",
    description: "AI conversation completion success rate",
  },
  webhookDelivery: {
    name: "webhook_delivery",
    target: 0.995, // 99.5% webhook delivery
    window: "24h",
    description: "Customer webhook delivery success rate",
  },
  queueLatency: {
    name: "queue_latency",
    target: 0.99, // 99% of jobs processed < 5s
    window: "1h",
    description: "Message queue processing latency p95 < 5000ms",
  },
};

export class SloService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Record a metric observation for SLO tracking
   */
  async recordMetric(input: SLOMetricInput): Promise<void> {
    const slo = SLO_DEFINITIONS[input.metricName];
    if (!slo) {
      logger.warn(`Unknown SLO metric: ${input.metricName}`);
      return;
    }

    try {
      const now = new Date();
      const windowStart = this.getWindowStart(now, slo.window);

      // Calculate error budget
      const errorBudget = 1 - slo.target; // e.g., 0.01 for 99% SLO
      const allowedErrorPercentage = errorBudget * 100;
      const currentError = 1 - input.currentValue;
      const currentErrorPercentage = currentError * 100;
      const remainingBudget = Math.max(0, allowedErrorPercentage - currentErrorPercentage);

      // Calculate burn rate
      const burnRate = currentErrorPercentage / allowedErrorPercentage;

      await this.prisma.sloMetric.create({
        data: {
          metricName: slo.name,
          tenantId: input.tenantId,
          sloTarget: slo.target,
          currentValue: input.currentValue,
          errorBudgetRemaining: remainingBudget,
          burnRate,
          windowStartAt: windowStart,
          windowEndAt: new Date(windowStart.getTime() + this.getWindowMs(slo.window)),
        },
      });
    } catch (error) {
      logger.error("Failed to record SLO metric", { error, input });
    }
  }

  /**
   * Get current SLO status
   */
  async getSLOStatus(
    metricName: string,
    tenantId?: string,
  ): Promise<{
    metricName: string;
    currentBurnRate: number;
    errorBudgetRemaining: number;
    status: "healthy" | "warning" | "critical";
  } | null> {
    try {
      const metric = await this.prisma.sloMetric.findFirst({
        where: {
          metricName,
          tenantId,
        },
        orderBy: { createdAt: "desc" },
      });

      if (!metric) return null;

      let status: "healthy" | "warning" | "critical" = "healthy";
      if (metric.burnRate > 0.5) status = "critical"; // Burning > 50% of monthly budget
      else if (metric.burnRate > 0.1) status = "warning"; // Burning > 10% of monthly budget

      return {
        metricName: metric.metricName,
        currentBurnRate: metric.burnRate,
        errorBudgetRemaining: metric.errorBudgetRemaining,
        status,
      };
    } catch (error) {
      logger.error("Failed to get SLO status", { error });
      return null;
    }
  }

  /**
   * Check if we should alert on SLO violation
   */
  async shouldAlertOnBurnRate(metricName: string, tenantId?: string): Promise<boolean> {
    const status = await this.getSLOStatus(metricName, tenantId);
    if (!status) return false;

    // Alert if critical or if trending to critical
    return status.status === "critical" || (status.status === "warning" && status.currentBurnRate > 0.2);
  }

  /**
   * Get availability percentage for a metric
   */
  async getAvailabilityPercentage(metricName: string, tenantId?: string): Promise<number> {
    try {
      const metrics = await this.prisma.sloMetric.findMany({
        where: {
          metricName,
          tenantId,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // last 24h
          },
        },
      });

      if (metrics.length === 0) return 100;

      const avgValue = metrics.reduce((sum, m) => sum + m.currentValue, 0) / metrics.length;
      return Math.round(avgValue * 10000) / 100; // 2 decimal places
    } catch (error) {
      logger.error("Failed to get availability percentage", { error });
      return 0;
    }
  }

  private getWindowStart(date: Date, window: string): Date {
    const d = new Date(date);
    switch (window) {
      case "1h":
        d.setMinutes(0, 0, 0);
        return d;
      case "24h":
        d.setHours(0, 0, 0, 0);
        return d;
      case "7d":
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay()); // Start of week
        return d;
      case "30d":
        d.setHours(0, 0, 0, 0);
        d.setDate(1); // First of month
        return d;
      default:
        return d;
    }
  }

  private getWindowMs(window: string): number {
    switch (window) {
      case "1h":
        return 60 * 60 * 1000;
      case "24h":
        return 24 * 60 * 60 * 1000;
      case "7d":
        return 7 * 24 * 60 * 60 * 1000;
      case "30d":
        return 30 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000;
    }
  }
}

export const createSloService = (prisma: PrismaClient) => new SloService(prisma);
