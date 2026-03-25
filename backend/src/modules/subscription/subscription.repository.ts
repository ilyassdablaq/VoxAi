import { prisma } from "../../infra/database/prisma.js";

export class SubscriptionRepository {
  async ensureDefaultFreePlanSubscription(userId: string) {
    const existingActive = await prisma.subscription.findFirst({
      where: { userId, status: "ACTIVE" },
      select: { id: true },
    });

    if (existingActive) {
      return;
    }

    const freePlan = await prisma.plan.findFirst({
      where: { key: "free", isActive: true },
      select: { id: true },
    });

    if (!freePlan) {
      return;
    }

    await prisma.subscription.create({
      data: {
        userId,
        planId: freePlan.id,
        status: "ACTIVE",
      },
    });
  }

  async getCurrentSubscriptionWithPlan(userId: string) {
    return prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: {
        plan: {
          select: {
            id: true,
            key: true,
            name: true,
            type: true,
            interval: true,
            priceCents: true,
            voiceMinutes: true,
            tokenLimit: true,
            features: true,
          },
        },
      },
      orderBy: { startsAt: 'desc' },
    });
  }

  async getAvailablePlans() {
    return prisma.plan.findMany({
      where: { isActive: true },
      select: {
        id: true,
        key: true,
        name: true,
        type: true,
        interval: true,
        priceCents: true,
        voiceMinutes: true,
        tokenLimit: true,
        features: true,
      },
      orderBy: [{ type: 'asc' }, { priceCents: 'asc' }],
    });
  }

  async updateSubscriptionWithStripe(
    subscriptionId: string,
    data: { stripeSubscriptionId?: string; stripeCustomerId?: string; status?: "ACTIVE" | "INACTIVE" | "CANCELED" | "EXPIRED" }
  ) {
    return prisma.subscription.update({
      where: { id: subscriptionId },
      data,
      include: { plan: true },
    });
  }
}
