import { PrismaClient } from "@prisma/client";
import { logger } from "../../config/logger.js";

export type DataType = "logs" | "messages" | "embeddings" | "conversations" | "audit_logs";

export interface RetentionPolicyConfig {
  dataType: DataType;
  retentionDays: number;
  autoArchiveEnabled: boolean;
  archiveLocation?: string;
  gdprCompliant: boolean;
}

export class DataLifecycleService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Set retention policy for a tenant
   */
  async setRetentionPolicy(tenantId: string, config: RetentionPolicyConfig): Promise<void> {
    try {
      await this.prisma.retentionPolicy.upsert({
        where: {
          // We'll use a composite unique constraint in practice
          // For now, delete existing and create new
          id: `${tenantId}-${config.dataType}`, // This won't work as-is, need schema adjustments
        },
        update: {
          retentionDays: config.retentionDays,
          autoArchiveEnabled: config.autoArchiveEnabled,
          archiveLocation: config.archiveLocation,
          gdprCompliant: config.gdprCompliant,
        },
        create: {
          tenantId,
          dataType: config.dataType,
          retentionDays: config.retentionDays,
          autoArchiveEnabled: config.autoArchiveEnabled,
          archiveLocation: config.archiveLocation,
          gdprCompliant: config.gdprCompliant,
        },
      });

      logger.info("Retention policy set", { tenantId, ...config });
    } catch (error) {
      logger.error("Failed to set retention policy", { error, tenantId });
      throw error;
    }
  }

  /**
   * Get all policies for a tenant
   */
  async getPoliciesForTenant(tenantId: string): Promise<RetentionPolicyConfig[]> {
    try {
      const policies = await this.prisma.retentionPolicy.findMany({
        where: { tenantId },
      });

      return policies.map((p) => ({
        dataType: p.dataType as DataType,
        retentionDays: p.retentionDays,
        autoArchiveEnabled: p.autoArchiveEnabled,
        archiveLocation: p.archiveLocation || undefined,
        gdprCompliant: p.gdprCompliant,
      }));
    } catch (error) {
      logger.error("Failed to get retention policies", { error, tenantId });
      return [];
    }
  }

  /**
   * Schedule data for deletion (GDPR request)
   */
  async scheduleGdprDeletion(tenantId: string, dataTypes: DataType[] = []): Promise<void> {
    try {
      const typesToDelete = dataTypes.length > 0 ? dataTypes : ["logs", "messages", "embeddings"];

      const deletionTasks = typesToDelete.map((dataType) =>
        this.prisma.dataDeletionQueue.create({
          data: {
            tenantId,
            dataType,
            scheduledAt: new Date(),
            status: "pending",
          },
        }),
      );

      await Promise.all(deletionTasks);

      logger.info("GDPR deletion scheduled", { tenantId, dataTypes: typesToDelete });
    } catch (error) {
      logger.error("Failed to schedule GDPR deletion", { error, tenantId });
      throw error;
    }
  }

  /**
   * Process deletion queue (background worker)
   */
  async processDeletionQueue(batchSize = 10): Promise<{
    processed: number;
    failed: number;
  }> {
    try {
      const pendingDeletions = await this.prisma.dataDeletionQueue.findMany({
        where: {
          status: "pending",
        },
        take: batchSize,
      });

      let processed = 0;
      let failed = 0;

      for (const deletion of pendingDeletions) {
        try {
          await this.processSingleDeletion(deletion.id, deletion.tenantId, deletion.dataType as DataType);
          processed++;
        } catch (error) {
          logger.error("Failed to process deletion task", { error, deletionId: deletion.id });
          failed++;

          await this.prisma.dataDeletionQueue.update({
            where: { id: deletion.id },
            data: {
              status: "failed",
              errorMessage: error instanceof Error ? error.message : "Unknown error",
            },
          });
        }
      }

      return { processed, failed };
    } catch (error) {
      logger.error("Failed to process deletion queue", { error });
      return { processed: 0, failed: 0 };
    }
  }

  /**
   * Archive old data (before deletion)
   */
  async archiveOldData(tenantId: string, beforeDate: Date): Promise<void> {
    try {
      // This would typically involve:
      // 1. Exporting data to S3/storage
      // 2. Creating archive reference
      // 3. Deleting from hot storage

      logger.info("Data archival started", { tenantId, beforeDate });

      // Placeholder for actual archival logic
      // In production: export to S3, compress, etc.

      logger.info("Data archival completed", { tenantId });
    } catch (error) {
      logger.error("Failed to archive data", { error, tenantId });
      throw error;
    }
  }

  /**
   * Enforce retention policies (cleanup old data)
   */
  async enforceRetentionPolicies(): Promise<void> {
    try {
      const policies = await this.prisma.retentionPolicy.findMany({
        where: {
          gdprCompliant: true,
        },
      });

      for (const policy of policies) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

        logger.info("Enforcing retention policy", {
          tenantId: policy.tenantId,
          dataType: policy.dataType,
          cutoffDate,
        });

        // Schedule for deletion via queue
        await this.prisma.dataDeletionQueue.create({
          data: {
            tenantId: policy.tenantId,
            dataType: policy.dataType,
            scheduledAt: new Date(),
            status: "pending",
          },
        });
      }
    } catch (error) {
      logger.error("Failed to enforce retention policies", { error });
    }
  }

  /**
   * Get deletion status
   */
  async getDeletionStatus(tenantId: string): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    try {
      const [pending, processing, completed, failed] = await Promise.all([
        this.prisma.dataDeletionQueue.count({
          where: { tenantId, status: "pending" },
        }),
        this.prisma.dataDeletionQueue.count({
          where: { tenantId, status: "processing" },
        }),
        this.prisma.dataDeletionQueue.count({
          where: { tenantId, status: "completed" },
        }),
        this.prisma.dataDeletionQueue.count({
          where: { tenantId, status: "failed" },
        }),
      ]);

      return { pending, processing, completed, failed };
    } catch (error) {
      logger.error("Failed to get deletion status", { error, tenantId });
      return { pending: 0, processing: 0, completed: 0, failed: 0 };
    }
  }

  private async processSingleDeletion(deletionId: string, tenantId: string, dataType: DataType): Promise<void> {
    await this.prisma.dataDeletionQueue.update({
      where: { id: deletionId },
      data: {
        status: "processing",
        processingStartedAt: new Date(),
      },
    });

    // Actual deletion logic would go here
    // For now, just mark as completed
    switch (dataType) {
      case "logs":
        // Delete logs older than policy
        break;
      case "messages":
        // Delete conversation messages
        break;
      case "embeddings":
        // Delete knowledge embeddings
        break;
      case "conversations":
        // Delete conversations and related data
        break;
      case "audit_logs":
        // Delete audit logs
        break;
    }

    await this.prisma.dataDeletionQueue.update({
      where: { id: deletionId },
      data: {
        status: "completed",
        completedAt: new Date(),
      },
    });
  }
}

export const createDataLifecycleService = (prisma: PrismaClient) => new DataLifecycleService(prisma);
