import { prisma } from "../../infra/database/prisma.js";
import { PlanType } from "@prisma/client";

const prismaClient = prisma as any;

export class AdminRepository {
  async getUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
    });
  }

  async searchUsers(query: string, limit: number) {
    return prisma.user.findMany({
      where: {
        OR: [
          { id: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async getActiveOverride(userId: string) {
    const now = new Date();
    return prismaClient.adminPlanOverride.findFirst({
      where: {
        userId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        plan: true,
        reason: true,
        expiresAt: true,
        createdAt: true,
        createdByAdminId: true,
      },
    });
  }

  async revokeAllActiveOverrides(userId: string, revokedAt: Date) {
    await prismaClient.adminPlanOverride.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt,
      },
    });
  }

  async createOverride(data: {
    userId: string;
    plan: PlanType;
    reason?: string;
    expiresAt?: Date;
    createdByAdminId: string;
  }) {
    return prismaClient.adminPlanOverride.create({
      data,
      select: {
        id: true,
        userId: true,
        plan: true,
        reason: true,
        expiresAt: true,
        createdAt: true,
        createdByAdminId: true,
        revokedAt: true,
      },
    });
  }

  async revokeActiveOverride(userId: string, revokedAt: Date) {
    const result = await prismaClient.adminPlanOverride.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt },
    });

    return result.count;
  }

  async getOverrideHistory(userId: string, limit: number) {
    return prismaClient.adminPlanOverride.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        plan: true,
        reason: true,
        expiresAt: true,
        createdAt: true,
        revokedAt: true,
        createdByAdminId: true,
        createdByAdmin: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });
  }

  async getCurrentSubscriptionPlan(userId: string) {
    return prisma.subscription.findFirst({
      where: {
        userId,
        status: "ACTIVE",
      },
      include: {
        plan: {
          select: {
            id: true,
            key: true,
            name: true,
            type: true,
            interval: true,
          },
        },
      },
      orderBy: { startsAt: "desc" },
    });
  }

  async getFallbackFreePlan() {
    return prisma.plan.findFirst({
      where: { type: "FREE", isActive: true },
      select: {
        id: true,
        key: true,
        name: true,
        type: true,
        interval: true,
      },
    });
  }
}
