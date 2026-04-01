import { PrismaClient } from "@prisma/client";
import { logger } from "../../config/logger.js";
import { getEnhancedServices } from "../enhanced-services.js";

/**
 * Integration hooks for the 6 new features
 * These show how the services should be used together in the application
 */

export class IntegrationHooks {
  private services = getEnhancedServices(new PrismaClient());

  /**
   * Pre-operation checks: SLO health + Billing safety
   */
  async preOperationCheck(userId: string, operationCost: number): Promise<{
    allowed: boolean;
    warnings: string[];
    recommendations: string[];
  }> {
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check spend limit
    const spendCheck = await this.services.billingSafety.checkSpendLimit(userId, operationCost);
    if (!spendCheck.allowed) {
      return {
        allowed: false,
        warnings: [`Hard spend limit reached. Current: $${(spendCheck.currentSpendCents / 100).toFixed(2)}`],
        recommendations: ["Please upgrade your plan or contact support"],
      };
    }

    if (spendCheck.reachedWarning) {
      warnings.push(`Spend warning: ${Math.round((spendCheck.currentSpendCents / spendCheck.budgetCents) * 100)}% of budget used`);
    }

    // Check SLO status
    const sloStatus = await this.services.slo.getSLOStatus("success_rate", userId);
    if (sloStatus?.status === "critical") {
      warnings.push("System under high error load, operations may be slower");
      recommendations.push("Consider waiting before retrying intensive operations");
    }

    // Check if upgrade is suggested
    const autoUpgrade = await this.services.billingSafety.suggestAutoUpgrade(userId);
    if (autoUpgrade?.suggested) {
      recommendations.push(`Consider upgrading to ${autoUpgrade.recommendedPlan} plan for $${(autoUpgrade.potentialSavings / 100).toFixed(2)} potential savings`);
    }

    return {
      allowed: spendCheck.allowed,
      warnings,
      recommendations,
    };
  }

  /**
   * Post-operation: record metrics and check gates
   */
  async postOperationMetrics(
    userId: string,
    operationCost: number,
    operationType: "chat" | "rag_query" | "model_inference",
    latencyMs: number,
    tokensUsed: number,
  ): Promise<void> {
    // Record spend
    await this.services.billingSafety.recordSpend(userId, operationCost);

    // Track SLO metrics
    switch (operationType) {
      case "chat":
        await this.services.slo.recordMetric({
          metricName: "chatLatencyP95",
          tenantId: userId,
          currentValue: latencyMs < 2000 ? 1 : 0,
          sloTarget: 0.95,
        });
        break;
      case "model_inference":
        await this.services.slo.recordMetric({
          metricName: "successRate",
          tenantId: userId,
          currentValue: latencyMs < 5000 ? 1 : 0.5,
          sloTarget: 0.99,
        });
        break;
    }

    // Check for SLO breach alerts
    const shouldAlert = await this.services.slo.shouldAlertOnBurnRate("success_rate", userId);
    if (shouldAlert) {
      logger.warn("SLO burn rate critical for user", { userId });
      // Could trigger email/slack alert here
    }
  }

  /**
   * Webhook event publishing integration
   */
  async publishWebhookEvent(
    userId: string,
    eventType: "conversation.created" | "message.processed" | "subscription.changed",
    data: Record<string, any>,
  ): Promise<void> {
    await this.services.webhookReplay.publishEvent(userId, eventType, data);
  }

  /**
   * API Key security check middleware
   */
  async validateApiKey(apiKeyString: string, requiredScope: "read" | "write" | "admin" = "read"): Promise<{
    valid: boolean;
    userId?: string;
    scopes?: string[];
    errorMessage?: string;
  }> {
    const key = await this.services.apiKeySecurity.verifyAndGetKey(apiKeyString);

    if (!key) {
      return {
        valid: false,
        errorMessage: "Invalid API key",
      };
    }

    if (!key.active) {
      return {
        valid: false,
        errorMessage: "API key has been revoked",
      };
    }

    if (!this.services.apiKeySecurity.hasScope(key, requiredScope)) {
      return {
        valid: false,
        errorMessage: `API key does not have ${requiredScope} scope`,
      };
    }

    // Check for rotation requirement
    if (key.nextRotationRequired && new Date() > key.nextRotationRequired) {
      logger.warn("API key requires rotation", { keyId: key.id });
    }

    return {
      valid: true,
      userId: key.id, // Store key ID as context
      scopes: key.scopes,
    };
  }

  /**
   * AI Model release gate check (before deploying model changes)
   */
  async checkAiReleaseGate(modelName: string, promptVersion: number): Promise<{
    approved: boolean;
    reason: string;
    metrics?: {
      avgSimilarity: number;
      avgQuality: number;
      p95Latency: number;
    };
  }> {
    const isApproved = await this.services.regressionSuite.isReleaseApproved(modelName, promptVersion);

    if (!isApproved) {
      const history = await this.services.regressionSuite.getEvaluationHistory(modelName, 5);
      const avgSimilarity =
        history.reduce((sum, h) => sum + h.similarityScore, 0) / Math.max(history.length, 1);
      const avgQuality = history.reduce((sum, h) => sum + h.qualityScore, 0) / Math.max(history.length, 1);

      return {
        approved: false,
        reason: `Release gate not met: similarity ${avgSimilarity.toFixed(2)} < 0.85 or quality ${avgQuality.toFixed(2)} < 0.80`,
        metrics: {
          avgSimilarity,
          avgQuality,
          p95Latency: 0,
        },
      };
    }

    return {
      approved: true,
      reason: "All release gate criteria met",
    };
  }

  /**
   * Background job: data lifecycle enforcement
   */
  async enforceDataLifecycle(): Promise<void> {
    // Archive old data
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90); // 90 days

    logger.info("Starting data lifecycle enforcement", { cutoffDate });

    // Enforce retention policies
    await this.services.dataLifecycle.enforceRetentionPolicies();

    // Process deletion queue
    const result = await this.services.dataLifecycle.processDeletionQueue(50);
    logger.info("Data deletion queue processed", { ...result });

    // Reset monthly spend counters
    await this.services.billingSafety.resetMonthlySpend();
  }

  /**
   * Background job: SLO monitoring
   */
  async monitorSlos(): Promise<void> {
    const metrics = ["chatLatencyP95", "successRate", "webhookDelivery", "queueLatency"];

    for (const metricName of metrics) {
      // In real scenario, would query time-series DB for actual metrics
      // For now, just log status
      logger.info(`SLO monitoring for ${metricName}`);
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(userId: string): Promise<{
    gdprDeletionStatus: { pending: number; processing: number; completed: number; failed: number };
    apiKeySecurityStatus: { activKeys: number; leakedKeys: number; keysNeedingRotation: number };
    dataRetention: Array<{ dataType: string; retentionDays: number; gdprCompliant: boolean }>;
    auditTrail: { totalEvents: number; criticalEvents: number; lastEvent?: Date };
  }> {
    const deletionStatus = await this.services.dataLifecycle.getDeletionStatus(userId);
    const apiKeys = await this.services.apiKeySecurity.listKeysForTenant(userId);
    const leakAlerts = await this.services.apiKeySecurity.getLeakDetectionAlerts(userId);
    const policies = await this.services.dataLifecycle.getPoliciesForTenant(userId);

    return {
      gdprDeletionStatus: deletionStatus,
      apiKeySecurityStatus: {
        activKeys: apiKeys.filter((k) => k.active).length,
        leakedKeys: leakAlerts.length,
        keysNeedingRotation: apiKeys.filter((k) => k.nextRotationRequired && new Date() > k.nextRotationRequired).length,
      },
      dataRetention: policies,
      auditTrail: {
        totalEvents: 0,
        criticalEvents: 0,
      },
    };
  }
}

export const integrationHooks = new IntegrationHooks();
