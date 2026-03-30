import { SubscriptionRepository } from "./subscription.repository.js";
import { AppError } from "../../common/errors/app-error.js";
import { prisma } from "../../infra/database/prisma.js";
import { PlanRepository } from "../plan/plan.repository.js";
import { PlanService } from "../plan/plan.service.js";
import { stripeService } from "../../services/stripe/stripe.service.js";

export class SubscriptionService {
  constructor(private readonly repository: SubscriptionRepository) {}

  private readonly planService = new PlanService(new PlanRepository());

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

  async getCurrentSubscription(userId: string) {
    await this.expireEndedSubscriptions(userId);
    await this.repository.ensureDefaultFreePlanSubscription(userId);
    const subscription = await this.repository.getCurrentSubscriptionWithPlan(userId);
    if (!subscription) {
      throw new AppError(404, 'SUBSCRIPTION_NOT_FOUND', 'No active subscription found');
    }
    return subscription;
  }

  async getAvailablePlans() {
    return this.repository.getAvailablePlans();
  }

  async cancelAtPeriodEnd(userId: string) {
    await this.expireEndedSubscriptions(userId);
    await this.repository.ensureDefaultFreePlanSubscription(userId);

    const currentSubscription = await this.repository.getCurrentSubscriptionWithPlan(userId);
    if (!currentSubscription) {
      throw new AppError(404, 'SUBSCRIPTION_NOT_FOUND', 'No active subscription found');
    }

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

      return this.getCurrentSubscription(userId);
    }

    // Non-Stripe subscriptions can be downgraded immediately.
    await this.planService.changePlan(userId, 'free');
    return this.getCurrentSubscription(userId);
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
