import { prisma } from "../../infra/database/prisma.js";
import { logger } from "../../config/logger.js";

export interface AuditLogEntry {
  userId?: string;
  principalType: "user" | "api_key" | "system";
  principalId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: Record<string, any>;
  status?: "success" | "failure";
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
}

class AuditLogService {
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: entry.userId,
          principalType: entry.principalType,
          principalId: entry.principalId,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          changes: entry.changes,
          status: entry.status ?? "success",
          errorMessage: entry.errorMessage,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });
    } catch (error) {
      logger.error({ error }, "Failed to write audit log");
    }
  }

  async queryLogs(
    filters: {
      action?: string;
      resourceType?: string;
      principalId?: string;
      principalType?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const { action, resourceType, principalId, principalType, startDate, endDate, limit = 50, offset = 0 } = filters;

    return prisma.auditLog.findMany({
      where: {
        ...(action && { action }),
        ...(resourceType && { resourceType }),
        ...(principalId && { principalId }),
        ...(principalType && { principalType }),
        ...(startDate && { createdAt: { gte: startDate } }),
        ...(endDate && { createdAt: { lte: endDate } }),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }

  async countCriticalActions(userId: string, action: string, windowHours: number = 24): Promise<number> {
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const result = await prisma.auditLog.count({
      where: {
        userId,
        action,
        createdAt: { gte: since },
      },
    });

    return result;
  }
}

export const auditLogService = new AuditLogService();
