import { PlanType } from "@prisma/client";
import { auditLogService } from "../../common/services/audit-log.service.js";
import { AppError } from "../../common/errors/app-error.js";
import { PlanCheckService } from "../../common/services/plan-check.service.js";
import { AdminRepository } from "./admin.repository.js";

interface AdminActionContext {
  ipAddress?: string;
  userAgent?: string;
}

interface SetOverrideInput {
  plan: PlanType;
  expiresAt?: string;
  reason?: string;
}

interface AuditLogResponseItem {
  id: string;
  adminId: string | null;
  targetUserId: string | null;
  action: string;
  reason: string | null;
  timestamp: string;
}

export class AdminService {
  constructor(
    private readonly repository: AdminRepository,
    private readonly planCheckService: PlanCheckService,
  ) {}

  async searchUsers(query: string, limit: number) {
    return this.repository.searchUsers(query.trim(), limit);
  }

  async setSubscriptionOverride(
    adminId: string,
    userId: string,
    payload: SetOverrideInput,
    context: AdminActionContext,
  ) {
    const targetUser = await this.repository.getUserById(userId);
    if (!targetUser) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    const now = new Date();
    const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : undefined;
    if (expiresAt && expiresAt <= now) {
      throw new AppError(400, "INVALID_OVERRIDE_EXPIRY", "expiresAt must be in the future");
    }

    const previousEffective = await this.planCheckService.getEffectivePlanAccess(userId);

    await this.repository.revokeAllActiveOverrides(userId, now);
    const createdOverride = await this.repository.createOverride({
      userId,
      plan: payload.plan,
      reason: payload.reason,
      expiresAt,
      createdByAdminId: adminId,
    });

    const newEffective = await this.planCheckService.getEffectivePlanAccess(userId);

    await auditLogService.log({
      userId: adminId,
      principalType: "user",
      principalId: adminId,
      action: "admin.subscription.override.set",
      resourceType: "user",
      resourceId: userId,
      changes: {
        adminId,
        targetUserId: userId,
        oldPlan: previousEffective.type,
        newPlan: newEffective.type,
        timestamp: new Date().toISOString(),
        before: {
          plan: previousEffective.type,
          source: previousEffective.source,
        },
        after: {
          plan: newEffective.type,
          source: newEffective.source,
          overrideExpiresAt: createdOverride.expiresAt?.toISOString() ?? null,
        },
        reason: payload.reason ?? null,
      },
      status: "success",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return {
      userId,
      plan: createdOverride.plan,
      reason: createdOverride.reason,
      expiresAt: createdOverride.expiresAt,
      createdAt: createdOverride.createdAt,
      createdByAdminId: createdOverride.createdByAdminId,
    };
  }

  async removeSubscriptionOverride(
    adminId: string,
    userId: string,
    context: AdminActionContext,
  ) {
    const targetUser = await this.repository.getUserById(userId);
    if (!targetUser) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    const previousEffective = await this.planCheckService.getEffectivePlanAccess(userId);
    const count = await this.repository.revokeActiveOverride(userId, new Date());
    if (count === 0) {
      throw new AppError(404, "OVERRIDE_NOT_FOUND", "No active override found for user");
    }

    const newEffective = await this.planCheckService.getEffectivePlanAccess(userId);

    await auditLogService.log({
      userId: adminId,
      principalType: "user",
      principalId: adminId,
      action: "admin.subscription.override.remove",
      resourceType: "user",
      resourceId: userId,
      changes: {
        adminId,
        targetUserId: userId,
        oldPlan: previousEffective.type,
        newPlan: newEffective.type,
        timestamp: new Date().toISOString(),
        before: {
          plan: previousEffective.type,
          source: previousEffective.source,
        },
        after: {
          plan: newEffective.type,
          source: newEffective.source,
        },
      },
      status: "success",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }

  async getEffectiveAccess(userId: string) {
    const targetUser = await this.repository.getUserById(userId);
    if (!targetUser) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    const effectivePlan = await this.planCheckService.getEffectivePlanAccess(userId);
    const fallbackSubscription = await this.repository.getCurrentSubscriptionPlan(userId);
    const activeOverride = await this.repository.getActiveOverride(userId);
    const now = new Date();

    const overrideActive = Boolean(
      activeOverride && (!activeOverride.expiresAt || activeOverride.expiresAt > now),
    );

    return {
      user: {
        id: targetUser.id,
        email: targetUser.email,
        fullName: targetUser.fullName,
        role: targetUser.role,
      },
      effectivePlan: {
        type: effectivePlan.type,
        key: effectivePlan.key,
        source: effectivePlan.source,
      },
      subscriptionPlan: fallbackSubscription?.plan
        ? {
            key: fallbackSubscription.plan.key,
            type: fallbackSubscription.plan.type,
            name: fallbackSubscription.plan.name,
            interval: fallbackSubscription.plan.interval,
          }
        : null,
      override: activeOverride
        ? {
            plan: activeOverride.plan,
            reason: activeOverride.reason,
            expiresAt: activeOverride.expiresAt,
            createdAt: activeOverride.createdAt,
            createdByAdminId: activeOverride.createdByAdminId,
            isActive: overrideActive,
            isExpired: Boolean(activeOverride.expiresAt && activeOverride.expiresAt <= now),
          }
        : null,
    };
  }

  async getOverrideHistory(userId: string, limit: number) {
    const targetUser = await this.repository.getUserById(userId);
    if (!targetUser) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    const history = (await this.repository.getOverrideHistory(userId, limit)) as Array<any>;
    return history.map((entry) => ({
      plan: entry.plan,
      reason: entry.reason,
      expiresAt: entry.expiresAt,
      createdAt: entry.createdAt,
      revokedAt: entry.revokedAt,
      createdByAdmin: entry.createdByAdmin
        ? {
            email: entry.createdByAdmin.email,
            fullName: entry.createdByAdmin.fullName,
          }
        : null,
    }));
  }

  async getAuditLogs(limit: number, offset: number): Promise<{ items: AuditLogResponseItem[]; total: number }> {
    const logs = await auditLogService.queryLogsPage({
      actionPrefix: "admin.subscription.override.",
      resourceType: "user",
      limit,
      offset,
    });

    return {
      items: logs.items.map((entry) => {
        const changes = (entry.changes ?? {}) as Record<string, unknown>;

        return {
          id: entry.id,
          adminId: entry.principalId,
          targetUserId: typeof changes.targetUserId === "string" ? changes.targetUserId : entry.resourceId,
          action: entry.action,
          reason: typeof changes.reason === "string" ? changes.reason : null,
          timestamp: entry.createdAt.toISOString(),
        };
      }),
      total: logs.total,
    };
  }
}
