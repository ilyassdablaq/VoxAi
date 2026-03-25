import { prisma } from "../../infra/database/prisma.js";
import { AppError } from "../errors/app-error.js";
import { PLAN_TYPES, PlanType, canAccessFeature } from "../constants/plan.constants.js";

export class PlanCheckService {
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
      const plan = await this.getUserPlan(userId);
      return canAccessFeature(plan.type, featureName);
    } catch {
      return false;
    }
  }

  /**
   * Check if user is on PRO or ENTERPRISE
   */
  async isProOrEnterprise(userId: string): Promise<boolean> {
    const plan = await this.getUserPlan(userId);
    return plan.type === PLAN_TYPES.PRO || plan.type === PLAN_TYPES.ENTERPRISE;
  }
}

export const planCheckService = new PlanCheckService();
