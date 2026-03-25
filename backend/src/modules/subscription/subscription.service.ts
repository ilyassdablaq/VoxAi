import { SubscriptionRepository } from "./subscription.repository.js";
import { AppError } from "../../common/errors/app-error.js";
import { prisma } from "../../infra/database/prisma.js";

export class SubscriptionService {
  constructor(private readonly repository: SubscriptionRepository) {}

  async getCurrentSubscription(userId: string) {
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
