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

export interface AuditLogQueryFilters {
  action?: string;
  actionPrefix?: string;
  resourceType?: string;
  principalId?: string;
  principalType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

function buildWhere(filters: AuditLogQueryFilters) {
  const { action, actionPrefix, resourceType, principalId, principalType, startDate, endDate } = filters;

  return {
    ...(action && { action }),
    ...(actionPrefix && { action: { startsWith: actionPrefix } }),
    ...(resourceType && { resourceType }),
    ...(principalId && { principalId }),
    ...(principalType && { principalType }),
    ...(startDate || endDate
      ? {
          createdAt: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          },
        }
      : {}),
  };
}

function isMissingAuditTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as { code?: string }).code;
  const meta = (error as { meta?: { table?: string } }).meta;
  return code === "P2021" && (meta?.table === "public.AuditLog" || meta?.table === "AuditLog");
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
      if (isMissingAuditTableError(error)) {
        logger.warn("AuditLog table missing; skipping audit write");
        return;
      }

      logger.error({ error }, "Failed to write audit log");
    }
  }

  async queryLogs(filters: AuditLogQueryFilters = {}) {
    const { limit = 50, offset = 0 } = filters;

    try {
      return await prisma.auditLog.findMany({
        where: buildWhere(filters),
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      });
    } catch (error) {
      if (isMissingAuditTableError(error)) {
        logger.warn("AuditLog table missing; returning empty audit log list");
        return [];
      }

      throw error;
    }
  }

  async countLogs(filters: AuditLogQueryFilters = {}): Promise<number> {
    try {
      return await prisma.auditLog.count({
        where: buildWhere(filters),
      });
    } catch (error) {
      if (isMissingAuditTableError(error)) {
        logger.warn("AuditLog table missing; returning zero audit log count");
        return 0;
      }

      throw error;
    }
  }

  async queryLogsPage(filters: AuditLogQueryFilters = {}) {
    const [items, total] = await Promise.all([this.queryLogs(filters), this.countLogs(filters)]);

    return {
      items,
      total,
    };
  }

  async countCriticalActions(userId: string, action: string, windowHours: number = 24): Promise<number> {
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    let result = 0;
    try {
      result = await prisma.auditLog.count({
        where: {
          userId,
          action,
          createdAt: { gte: since },
        },
      });
    } catch (error) {
      if (!isMissingAuditTableError(error)) {
        throw error;
      }

      logger.warn("AuditLog table missing; returning zero critical action count");
    }

    return result;
  }
}

export const auditLogService = new AuditLogService();
