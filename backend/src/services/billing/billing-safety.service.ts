import { PrismaClient } from "@prisma/client";
import { logger } from "../../config/logger.js";
import { AppError } from "../../common/errors/app-error.js";

export interface SpendLimitCheckResult {
  allowed: boolean;
  currentSpendCents: number;
  budgetCents: number;
  remainingBudgetCents: number;
  reachedWarning: boolean;
  nextResetAt: Date;
}

export class BillingSafetyService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Set or update spend cap for a tenant
   */
  async setSpendCap(
    tenantId: string,
    plan: string,
    monthlyBudgetCents: number,
    hardLimitEnabled = true,
  ): Promise<void> {
    try {
      await this.prisma.spendCap.upsert({
          increment: castCents as any,
        update: {
          plan,
          monthlyBudgetCents,
          hardLimitEnabled,
          lastResetAt: new Date(),
        const budget = Number(updated.monthlyBudgetCents);
        const current = Number(updated.currentMonthSpendCents);
        const warningThreshold = (budget * updated.warningThresholdPercent) / 100;
        if (current > warningThreshold) {
          tenantId,
        if (current > budget) {
          monthlyBudgetCents,
          hardLimitEnabled,
          warningThresholdPercent: 80,
          gracePeriodDays: 3,
          lastResetAt: new Date(),
        },
      });

      logger.info(`Spend cap set (${tenantId})`);
    } catch (error) {
      logger.error(`Failed to set spend cap (${tenantId})`);
      throw error;
    }
  }

  /**
   * Check if tenant can spend more (pre-flight check)
   */
  async checkSpendLimit(tenantId: string, estimatedCostCents: number): Promise<SpendLimitCheckResult> {
    try {
      const spendCap = await this.prisma.spendCap.findUnique({ where: { tenantId } });

      if (!spendCap) {
        // No cap = unlimited
        return {
          allowed: true,
          currentSpendCents: 0,
          budgetCents: Infinity,
          remainingBudgetCents: Infinity,
          reachedWarning: false,
          nextResetAt: this.getNextMonthResetDate(),
        };
      }

      const budget = Number(spendCap.monthlyBudgetCents);
      const current = Number(spendCap.currentMonthSpendCents);
      const remainingBudget = budget - current;
      const newTotal = current + estimatedCostCents;
      const warningThreshold = (budget * spendCap.warningThresholdPercent) / 100;
      const reachedWarning = newTotal > warningThreshold;

      // Check hard limit
      const exceedsHardLimit = newTotal > spendCap.monthlyBudgetCents && spendCap.hardLimitEnabled;

      return {
        allowed: !exceedsHardLimit,
        currentSpendCents: current,
        budgetCents: budget,
        remainingBudgetCents: Math.max(0, remainingBudget - estimatedCostCents),
        reachedWarning,
        nextResetAt: spendCap.lastResetAt ? this.getNextMonthResetDate(spendCap.lastResetAt) : this.getNextMonthResetDate(),
      };
    } catch (error) {
      logger.error(`Failed to check spend limit (${tenantId})`);
      throw error;
    }
  }

  /**
   * Log spend (after operation)
   */
  async recordSpend(tenantId: string, costCents: number): Promise<void> {
    try {
      const spendCap = await this.prisma.spendCap.findUnique({ where: { tenantId } });

      if (!spendCap) {
        // Create default cap if doesn't exist
        await this.setSpendCap(tenantId, "FREE", 0, true);
        return;
      }

      await this.prisma.spendCap.update({
        where: { tenantId },
        data: {
          currentMonthSpendCents: {
            increment: costCents,
          },
        },
      });

      // Check if warning threshold reached
      const updated = await this.prisma.spendCap.findUnique({ where: { tenantId } });
      if (updated) {
        const warningThreshold = (updated.monthlyBudgetCents * updated.warningThresholdPercent) / 100;
        if (updated.currentMonthSpendCents > warningThreshold) {
          logger.warn(`Spend warning (${tenantId}):`);
            tenantId,
            currentSpend: updated.currentMonthSpendCents,
            budget: updated.monthlyBudgetCents,
          });
        }

        if (updated.currentMonthSpendCents > updated.monthlyBudgetCents) {
          logger.error(`Hard spend limit (${updated.tenantId}):`);
            tenantId,
            currentSpend: updated.currentMonthSpendCents,
            budget: updated.monthlyBudgetCents,
          });
        }
      }
    } catch (error) {
      logger.error(`Failed to record spend (${tenantId})`);
    }
  }

  /**
   * Get spend report for tenant
   */
  async getSpendReport(tenantId: string): Promise<{
    plan: string;
    budgetCents: number;
    currentSpendCents: number;
    percentageUsed: number;
    remainingCents: number;
    nextResetAt: Date;
    status: "healthy" | "warning" | "critical";
  } | null> {
    try {
      const spendCap = await this.prisma.spendCap.findUnique({ where: { tenantId } });

      if (!spendCap) return null;

      const percentageUsed = (spendCap.currentMonthSpendCents / spendCap.monthlyBudgetCents) * 100;
      let status: "healthy" | "warning" | "critical" = "healthy";
      if (percentageUsed > 100) status = "critical";
      else if (percentageUsed > spendCap.warningThresholdPercent) status = "warning";

      return {
        plan: spendCap.plan,
        budgetCents: spendCap.monthlyBudgetCents,
        currentSpendCents: spendCap.currentMonthSpendCents,
        percentageUsed: Math.round(percentageUsed * 100) / 100,
        remainingCents: spendCap.monthlyBudgetCents - spendCap.currentMonthSpendCents,
        nextResetAt: spendCap.lastResetAt ? this.getNextMonthResetDate(spendCap.lastResetAt) : this.getNextMonthResetDate(),
        status,
      };
    } catch (error) {
      logger.error(`Failed to get spend report (${tenantId})`);
      return null;
    }
  }

  /**
   * Auto-upgrade flow: suggest/apply upgrade based on spend
   */
  async suggestAutoUpgrade(tenantId: string): Promise<{
    suggested: boolean;
    currentPlan: string;
    recommendedPlan: string;
    potentialSavings: number;
  } | null> {
    try {
      const spendCap = await this.prisma.spendCap.findUnique({ where: { tenantId } });

      if (!spendCap) return null;

      const percentageUsed = (spendCap.currentMonthSpendCents / spendCap.monthlyBudgetCents) * 100;

      // If using > 80% of budget, suggest upgrade
      if (percentageUsed > 80 && spendCap.plan !== "ENTERPRISE") {
        const nextPlan = spendCap.plan === "FREE" ? "PRO" : "ENTERPRISE";
        const potentialBudget = nextPlan === "PRO" ? 10000 * 100 : 50000 * 100; // Rough estimates
        const potentialSavings = potentialBudget - spendCap.currentMonthSpendCents;

        return {
          suggested: true,
          currentPlan: spendCap.plan,
          recommendedPlan: nextPlan,
          potentialSavings: Math.max(0, potentialSavings),
        };
      }

      return {
        suggested: false,
        currentPlan: spendCap.plan,
        recommendedPlan: spendCap.plan,
        potentialSavings: 0,
      };
    } catch (error) {
      logger.error(`Failed to auto upgrade (${tenantId})`);
      return null;
    }
  }

  /**
   * Reset spend counters monthly
   */
  async resetMonthlySpend(): Promise<void> {
    try {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      await this.prisma.spendCap.updateMany({
        where: {
          lastResetAt: {
            lt: firstOfMonth,
          },
        },
        data: {
          currentMonthSpendCents: 0,
          lastResetAt: now,
        },
      });

      logger.info("Monthly spend reset completed");
    } catch (error) {
      logger.error("Failed to reset monthly spend", { error });
    }
  }

  private getNextMonthResetDate(fromDate?: Date): Date {
    const d = fromDate ? new Date(fromDate) : new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}

export const createBillingSafetyService = (prisma: PrismaClient) => new BillingSafetyService(prisma);
