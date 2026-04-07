import { prisma } from "../../infra/database/prisma.js";
import { AppError } from "../errors/app-error.js";
import { PLAN_TYPES, PlanType, canAccessFeature } from "../constants/plan.constants.js";

const prismaClient = prisma as any;

export class PlanCheckService {
  private async cleanupExpiredOverrides(userId: string): Promise<void> {
    const now = new Date();
    await prismaClient.adminPlanOverride.updateMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { lte: now },
      },
      data: { revokedAt: now },
    });
  }

  async getActiveOverride(userId: string): Promise<{ plan: PlanType; expiresAt: Date | null } | null> {
    await this.cleanupExpiredOverrides(userId);

    const now = new Date();
    const activeOverride = await prismaClient.adminPlanOverride.findFirst({
      where: {
        userId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
      select: {
        plan: true,
        expiresAt: true,
      },
    });

    if (!activeOverride) {
      return null;
    }

    return {
      plan: activeOverride.plan as PlanType,
      expiresAt: activeOverride.expiresAt,
    };
  }

  async getEffectivePlanAccess(userId: string): Promise<{ type: PlanType; key: string; source: "subscription" | "admin_override" }> {
    const activeOverride = await this.getActiveOverride(userId);

    if (activeOverride) {
      const plan = await prisma.plan.findFirst({
        where: {
          type: activeOverride.plan,
          isActive: true,
        },
        select: { key: true },
      });

      return {
        type: activeOverride.plan,
        key: plan?.key ?? activeOverride.plan.toLowerCase(),
        source: "admin_override",
      };
    }

    const plan = await this.getUserPlan(userId);
    return { ...plan, source: "subscription" };
  }

  /**
   * Get user's current active plan
   */
  async getUserPlan(userId: string): Promise<{ type: PlanType; key: string }> {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
      include: {
        plan: {
          select: { type: true, key: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      // Auto-provision FREE plan if missing (same logic as PlanService)
      const freePlan = await prisma.plan.findFirst({
        where: { type: PLAN_TYPES.FREE, isActive: true },
      });

      if (!freePlan) {
        throw new AppError(500, 'NO_FREE_PLAN', 'System error: no free plan available');
      }

      await prisma.subscription.create({
        data: {
          userId,
          planId: freePlan.id,
          status: 'ACTIVE',
        },
      });

      return { type: PLAN_TYPES.FREE, key: freePlan.key };
    }

    return {
      type: subscription.plan.type as PlanType,
      key: subscription.plan.key,
    };
  }

  /**
   * Check if user can access a feature
   */
  async canAccessFeature(userId: string, featureName: string): Promise<boolean> {
    try {
      const plan = await this.getEffectivePlanAccess(userId);
      return canAccessFeature(plan.type, featureName);
    } catch {
      return false;
    }
  }

  /**
   * Check if user is on PRO or ENTERPRISE
   */
  async isProOrEnterprise(userId: string): Promise<boolean> {
    const plan = await this.getEffectivePlanAccess(userId);
    return plan.type === PLAN_TYPES.PRO || plan.type === PLAN_TYPES.ENTERPRISE;
  }
}

export const planCheckService = new PlanCheckService();
