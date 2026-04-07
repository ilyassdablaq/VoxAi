import { SubscriptionRepository } from "./subscription.repository.js";
import { AppError } from "../../common/errors/app-error.js";
import { prisma } from "../../infra/database/prisma.js";
import { PlanRepository } from "../plan/plan.repository.js";
import { PlanService } from "../plan/plan.service.js";
import { stripeService } from "../../services/stripe/stripe.service.js";
import { PlanCheckService } from "../../common/services/plan-check.service.js";

export class SubscriptionService {
  constructor(private readonly repository: SubscriptionRepository) {}

  private readonly planService = new PlanService(new PlanRepository());
  private readonly planCheckService = new PlanCheckService();

  private async expireEndedSubscriptions(userId: string) {
    await prisma.subscription.updateMany({
      where: {
        userId,
        status: 'ACTIVE',
        endsAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });
  }

  private async getCurrentBillingSubscription(userId: string) {
    await this.expireEndedSubscriptions(userId);
    await this.repository.ensureDefaultFreePlanSubscription(userId);
    const subscription = await this.repository.getCurrentSubscriptionWithPlan(userId);
    if (!subscription) {
      throw new AppError(404, 'SUBSCRIPTION_NOT_FOUND', 'No active subscription found');
    }

    return subscription;
  }

  async getCurrentSubscription(userId: string) {
    const subscription = await this.getCurrentBillingSubscription(userId);

    const activeOverride = await this.planCheckService.getActiveOverride(userId);
    const effectivePlan = await this.planCheckService.getEffectivePlanAccess(userId);

    return {
      plan: subscription.plan.type,
      effectivePlan: effectivePlan.type,
      isOverride: effectivePlan.source === "admin_override",
      overrideExpiresAt: activeOverride?.expiresAt ?? null,
    };
  }

  async getAvailablePlans() {
    return this.repository.getAvailablePlans();
  }

  async cancelAtPeriodEnd(userId: string) {
    const currentSubscription = await this.getCurrentBillingSubscription(userId);

    if (currentSubscription.plan.key === 'free') {
      return currentSubscription;
    }

    if (currentSubscription.stripeSubscriptionId) {
      const cancellation = await stripeService.scheduleCancellationAtPeriodEnd(currentSubscription.stripeSubscriptionId);

      await prisma.subscription.update({
        where: { id: currentSubscription.id },
        data: {
          status: 'ACTIVE',
          endsAt: cancellation.currentPeriodEnd,
        },
      });

      return this.getCurrentBillingSubscription(userId);
    }

    // Non-Stripe subscriptions can be downgraded immediately.
    await this.planService.changePlan(userId, 'free');
    return this.getCurrentBillingSubscription(userId);
  }

  async validateSubscriptionActive(userId: string): Promise<boolean> {
    const subscription = await prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      select: { id: true, endsAt: true },
    });

    if (!subscription) return false;

    // Check if subscription has expired
    if (subscription.endsAt && new Date(subscription.endsAt) < new Date()) {
      return false;
    }

    return true;
  }
}
