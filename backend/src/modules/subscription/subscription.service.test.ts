import { describe, it, expect, beforeEach, vi } from "vitest";
import { SubscriptionService } from "./subscription.service";
import { SubscriptionRepository } from "./subscription.repository";
import { PlanService } from "../plan/plan.service";
import { testFixtures } from "@/test/mocks";
import { AppError } from "@/common/errors/app-error";

vi.mock("@/infra/database/prisma", () => ({
  prisma: {
    adminPlanOverride: {
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
    plan: {
      findFirst: vi.fn(),
    },
    subscription: {
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/services/stripe/stripe.service", () => ({
  stripeService: {
    scheduleCancellationAtPeriodEnd: vi.fn(),
  },
}));

vi.mock("../plan/plan.service");

import { prisma } from "@/infra/database/prisma";
import { stripeService } from "@/services/stripe/stripe.service";

describe("SubscriptionService", () => {
  let subscriptionService: SubscriptionService;
  let mockRepository: any;
  let mockPlanService: any;

  beforeEach(() => {
    mockRepository = {
      ensureDefaultFreePlanSubscription: vi.fn(),
      getCurrentSubscriptionWithPlan: vi.fn(),
      getAvailablePlans: vi.fn(),
    };

    mockPlanService = {
      changePlan: vi.fn(),
    };

    vi.mocked(PlanService).mockImplementation(() => mockPlanService as any);

    vi.mocked(prisma.adminPlanOverride.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.adminPlanOverride.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.plan.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
      plan: {
        type: "FREE",
        key: "free",
      },
    } as never);

    subscriptionService = new SubscriptionService(mockRepository);
  });

  describe("getCurrentSubscription", () => {
    it("should return current subscription with plan", async () => {
      const subscriptionWithPlan = {
        ...testFixtures.subscription,
        plan: testFixtures.plan,
      };

      mockRepository.ensureDefaultFreePlanSubscription.mockResolvedValue(undefined);
      mockRepository.getCurrentSubscriptionWithPlan.mockResolvedValue(
        subscriptionWithPlan
      );
      vi.mocked(prisma.subscription.updateMany).mockResolvedValue({ count: 0 } as never);

      const result = await subscriptionService.getCurrentSubscription(testFixtures.user.id);

      expect(result.plan).toBe("FREE");
      expect(result.effectivePlan).toBe("FREE");
      expect(result.isOverride).toBe(false);
      expect(result.overrideExpiresAt).toBeNull();
      expect(mockRepository.ensureDefaultFreePlanSubscription).toHaveBeenCalledWith(
        testFixtures.user.id
      );
      expect(mockRepository.getCurrentSubscriptionWithPlan).toHaveBeenCalledWith(
        testFixtures.user.id
      );
    });

    it("should expire subscriptions that have ended", async () => {
      mockRepository.ensureDefaultFreePlanSubscription.mockResolvedValue(undefined);
      mockRepository.getCurrentSubscriptionWithPlan.mockResolvedValue({
        ...testFixtures.subscription,
        plan: testFixtures.plan,
      });
      vi.mocked(prisma.subscription.updateMany).mockResolvedValue({ count: 1 } as never);

      await subscriptionService.getCurrentSubscription(testFixtures.user.id);

      expect(vi.mocked(prisma.subscription.updateMany)).toHaveBeenCalledWith({
        where: {
          userId: testFixtures.user.id,
          status: "ACTIVE",
          endsAt: { lt: expect.any(Date) },
        },
        data: { status: "EXPIRED" },
      });
    });

    it("should throw SUBSCRIPTION_NOT_FOUND when no subscription exists", async () => {
      mockRepository.ensureDefaultFreePlanSubscription.mockResolvedValue(undefined);
      mockRepository.getCurrentSubscriptionWithPlan.mockResolvedValue(null);
      vi.mocked(prisma.subscription.updateMany).mockResolvedValue({ count: 0 } as never);

      await expect(
        subscriptionService.getCurrentSubscription(testFixtures.user.id)
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 404,
          code: "SUBSCRIPTION_NOT_FOUND",
        })
      );
    });

    it("should auto-provision free plan subscription if missing", async () => {
      const freeSubscription = {
        ...testFixtures.subscription,
        plan: testFixtures.plan,
      };

      mockRepository.ensureDefaultFreePlanSubscription.mockResolvedValue(undefined);
      mockRepository.getCurrentSubscriptionWithPlan.mockResolvedValue(freeSubscription);
      vi.mocked(prisma.subscription.updateMany).mockResolvedValue({ count: 0 } as never);

      await subscriptionService.getCurrentSubscription(testFixtures.user.id);

      expect(mockRepository.ensureDefaultFreePlanSubscription).toHaveBeenCalledWith(
        testFixtures.user.id
      );
    });
  });

  describe("getAvailablePlans", () => {
    it("should return list of available plans", async () => {
      const plans = [testFixtures.plan, testFixtures.proPlan];
      mockRepository.getAvailablePlans.mockResolvedValue(plans);

      const result = await subscriptionService.getAvailablePlans();

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe("free");
      expect(result[1].key).toBe("pro");
    });
  });

  describe("cancelAtPeriodEnd", () => {
    it("should return free subscription immediately without cancellation", async () => {
      const freeSubscription = {
        ...testFixtures.subscription,
        plan: testFixtures.plan,
      };

      mockRepository.ensureDefaultFreePlanSubscription.mockResolvedValue(undefined);
      mockRepository.getCurrentSubscriptionWithPlan.mockResolvedValue(freeSubscription);
      vi.mocked(prisma.subscription.updateMany).mockResolvedValue({ count: 0 } as never);

      const result = await subscriptionService.cancelAtPeriodEnd(testFixtures.user.id);

      expect(result.plan.key).toBe("free");
      expect(vi.mocked(stripeService.scheduleCancellationAtPeriodEnd)).not.toHaveBeenCalled();
    });

    it("should schedule Stripe cancellation at period end for Stripe subscriptions", async () => {
      const stripeSubscription = {
        ...testFixtures.subscription,
        stripeSubscriptionId: "sub_stripe_123",
        plan: testFixtures.proPlan,
      };

      const periodEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      mockRepository.ensureDefaultFreePlanSubscription.mockResolvedValue(undefined);
      mockRepository.getCurrentSubscriptionWithPlan.mockResolvedValueOnce(
        stripeSubscription
      );
      mockRepository.getCurrentSubscriptionWithPlan.mockResolvedValueOnce({
        ...stripeSubscription,
        endsAt: periodEndDate,
      });
      vi.mocked(prisma.subscription.updateMany).mockResolvedValue({ count: 0 } as never);
      vi.mocked(stripeService.scheduleCancellationAtPeriodEnd).mockResolvedValue({
        currentPeriodEnd: periodEndDate,
      } as never);
      vi.mocked(prisma.subscription.update).mockResolvedValue(stripeSubscription as never);

      await subscriptionService.cancelAtPeriodEnd(testFixtures.user.id);

      expect(
        vi.mocked(stripeService.scheduleCancellationAtPeriodEnd)
      ).toHaveBeenCalledWith("sub_stripe_123");
      expect(vi.mocked(prisma.subscription.update)).toHaveBeenCalledWith({
        where: { id: stripeSubscription.id },
        data: {
          status: "ACTIVE",
          endsAt: periodEndDate,
        },
      });
    });

    it("should downgrade non-Stripe subscriptions to free immediately", async () => {
      const nonStripeSubscription = {
        ...testFixtures.subscription,
        stripeSubscriptionId: null,
        plan: testFixtures.proPlan,
      };

      mockRepository.ensureDefaultFreePlanSubscription.mockResolvedValue(undefined);
      mockRepository.getCurrentSubscriptionWithPlan.mockResolvedValue(
        nonStripeSubscription
      );
      mockPlanService.changePlan.mockResolvedValue({
        ...testFixtures.subscription,
        plan: testFixtures.plan,
      });
      vi.mocked(prisma.subscription.updateMany).mockResolvedValue({ count: 0 } as never);

      await subscriptionService.cancelAtPeriodEnd(testFixtures.user.id);

      expect(mockPlanService.changePlan).toHaveBeenCalledWith(
        testFixtures.user.id,
        "free"
      );
    });

    it("should throw SUBSCRIPTION_NOT_FOUND when no subscription exists", async () => {
      mockRepository.ensureDefaultFreePlanSubscription.mockResolvedValue(undefined);
      mockRepository.getCurrentSubscriptionWithPlan.mockResolvedValue(null);
      vi.mocked(prisma.subscription.updateMany).mockResolvedValue({ count: 0 } as never);

      await expect(
        subscriptionService.cancelAtPeriodEnd(testFixtures.user.id)
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 404,
          code: "SUBSCRIPTION_NOT_FOUND",
        })
      );
    });
  });

  describe("validateSubscriptionActive", () => {
    it("should return true for active, non-expired subscription", async () => {
      const activeSubscription = {
        id: testFixtures.subscription.id,
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(
        activeSubscription as never
      );

      const result = await subscriptionService.validateSubscriptionActive(
        testFixtures.user.id
      );

      expect(result).toBe(true);
    });

    it("should return false for expired subscription", async () => {
      const expiredSubscription = {
        id: testFixtures.subscription.id,
        endsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      };

      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(
        expiredSubscription as never
      );

      const result = await subscriptionService.validateSubscriptionActive(
        testFixtures.user.id
      );

      expect(result).toBe(false);
    });

    it("should return false when no subscription found", async () => {
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null as never);

      const result = await subscriptionService.validateSubscriptionActive(
        testFixtures.user.id
      );

      expect(result).toBe(false);
    });

    it("should return true for subscription without end date", async () => {
      const indefiniteSubscription = {
        id: testFixtures.subscription.id,
        endsAt: null,
      };

      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(
        indefiniteSubscription as never
      );

      const result = await subscriptionService.validateSubscriptionActive(
        testFixtures.user.id
      );

      expect(result).toBe(true);
    });
  });
});
