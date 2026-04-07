import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../infra/database/prisma.js", () => ({
  prisma: {
    adminPlanOverride: {
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
    subscription: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    plan: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "../../infra/database/prisma.js";
import { planCheckService } from "./plan-check.service";

const prismaClient = prisma as any;

describe("PlanCheckService admin override", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses active admin override when present", async () => {
    vi.mocked(prismaClient.adminPlanOverride.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prismaClient.adminPlanOverride.findFirst).mockResolvedValue({
      plan: "PRO",
    } as never);
    vi.mocked(prisma.plan.findFirst).mockResolvedValue({ key: "pro" } as never);

    const effectivePlan = await planCheckService.getEffectivePlanAccess("user-1");

    expect(effectivePlan).toEqual({
      type: "PRO",
      key: "pro",
      source: "admin_override",
    });
  });

  it("falls back to subscription plan when override is absent or expired", async () => {
    vi.mocked(prismaClient.adminPlanOverride.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prismaClient.adminPlanOverride.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
      plan: {
        type: "FREE",
        key: "free",
      },
    } as never);

    const effectivePlan = await planCheckService.getEffectivePlanAccess("user-2");

    expect(effectivePlan).toEqual({
      type: "FREE",
      key: "free",
      source: "subscription",
    });

    expect(prismaClient.adminPlanOverride.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-2",
        revokedAt: null,
        expiresAt: { lte: expect.any(Date) },
      },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
