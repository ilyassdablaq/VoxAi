import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { logger } from "../../config/logger.js";

export type ApiKeyScope = "read" | "write" | "admin";

export interface ScopedApiKey {
  id: string;
  keyPrefix: string;
  keyHash: string;
  scopes: ApiKeyScope[];
  name?: string;
  lastUsedAt?: Date;
  lastUsedIp?: string;
  active: boolean;
  rotationStatus: "active" | "rotating" | "rotated";
  nextRotationRequired?: Date;
  createdAt: Date;
}

export class ApiKeySecurityService {
  private readonly ROTATION_INTERVAL_DAYS = 90;
  private readonly KEY_PREFIX_LENGTH = 10;
  private readonly KEY_SECRET_LENGTH = 32;

  constructor(private prisma: PrismaClient) {}

  /**
   * Generate a new scoped API key
   */
  async generateScopedKey(
    tenantId: string,
    scopes: ApiKeyScope[],
    name?: string,
  ): Promise<{
    fullKey: string; // Only returned once
    key: ScopedApiKey;
  }> {
    try {
      const prefix = `sk_${this.randomString(8)}`;
      const secret = randomBytes(this.KEY_SECRET_LENGTH).toString("hex");
      const fullKey = `${prefix}_${secret}`;
      const keyHash = this.hashKey(fullKey);

      const nextRotationRequired = new Date();
      nextRotationRequired.setDate(nextRotationRequired.getDate() + this.ROTATION_INTERVAL_DAYS);

      const key = await this.prisma.apiKeyV2.create({
        data: {
          tenantId,
          keyPrefix: prefix,
          keyHash,
          scopes: scopes.join(","),
          name,
          active: true,
          nextRotationRequiredAt: nextRotationRequired,
        },
      });

      logger.info("API key generated", { tenantId, name, scopes });

      return {
        fullKey,
        key: this.mapToScopedApiKey(key),
      };
    } catch (error) {
      logger.error("Failed to generate API key", { error, tenantId });
      throw error;
    }
  }

  /**
   * Verify and get API key details
   */
  async verifyAndGetKey(fullKey: string): Promise<ScopedApiKey | null> {
    try {
      const keyHash = this.hashKey(fullKey);

      const key = await this.prisma.apiKeyV2.findUnique({
        where: { keyHash },
      });

      if (!key || !key.active) {
        return null;
      }

      // Update last used
      await this.prisma.apiKeyV2.update({
        where: { id: key.id },
        data: {
          lastUsedAt: new Date(),
        },
      });

      return this.mapToScopedApiKey(key);
    } catch (error) {
      logger.error("Failed to verify API key", { error });
      return null;
    }
  }

  /**
   * Check if key has specific scope
   */
  hasScope(key: ScopedApiKey, requiredScope: ApiKeyScope): boolean {
    return key.scopes.includes(requiredScope) || key.scopes.includes("admin");
  }

  /**
   * Track API key usage with IP fingerprint
   */
  async trackKeyUsage(keyId: string, ipAddress: string): Promise<void> {
    try {
      await this.prisma.apiKeyV2.update({
        where: { id: keyId },
        data: {
          lastUsedAt: new Date(),
          lastUsedIp: ipAddress,
        },
      });

      // Detect unusual IP usage patterns
      await this.detectAnomalousUsage(keyId, ipAddress);
    } catch (error) {
      logger.error("Failed to track key usage", { error, keyId });
    }
  }

  /**
   * Rotate API key (revoke old, issue new)
   */
  async rotateApiKey(
    keyId: string,
  ): Promise<{
    oldKey: ScopedApiKey;
    newKey: {
      fullKey: string;
      key: ScopedApiKey;
    };
  } | null> {
    try {
      const oldKey = await this.prisma.apiKeyV2.findUnique({
        where: { id: keyId },
      });

      if (!oldKey) return null;

      // Mark old key as rotating
      await this.prisma.apiKeyV2.update({
        where: { id: keyId },
        data: {
          rotationInProgress: true,
        },
      });

      // Generate new key with same scopes
      const scopes = oldKey.scopes.split(",") as ApiKeyScope[];
      const newKeyResult = await this.generateScopedKey(oldKey.tenantId, scopes, oldKey.name);

      // Revoke old key (grace period optional)
      await this.prisma.apiKeyV2.update({
        where: { id: keyId },
        data: {
          active: false,
          rotationInProgress: false,
          lastRotatedAt: new Date(),
        },
      });

      logger.info("API key rotated", { keyId, tenantId: oldKey.tenantId });

      return {
        oldKey: this.mapToScopedApiKey(oldKey),
        newKey: newKeyResult,
      };
    } catch (error) {
      logger.error("Failed to rotate API key", { error, keyId });
      return null;
    }
  }

  /**
   * Report leaked key
   */
  async reportLeakedKey(keyId: string, source: string, severity: "low" | "medium" | "high"): Promise<void> {
    try {
      const key = await this.prisma.apiKeyV2.findUnique({
        where: { id: keyId },
      });

      if (!key) return;

      // Record leak
      await this.prisma.leakedApiKey.create({
        data: {
          apiKeyId: keyId,
          tenantId: key.tenantId,
          detectionSource: source,
          detectedAt: new Date(),
          severity,
          actionTaken: "investigating",
        },
      });

      // Immediately rotate the key
      await this.rotateApiKey(keyId);

      logger.warn("Leaked API key reported and rotated", { keyId, source, severity });
    } catch (error) {
      logger.error("Failed to report leaked key", { error, keyId });
    }
  }

  /**
   * List all keys for a tenant
   */
  async listKeysForTenant(tenantId: string): Promise<ScopedApiKey[]> {
    try {
      const keys = await this.prisma.apiKeyV2.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
      });

      return keys.map(this.mapToScopedApiKey);
    } catch (error) {
      logger.error("Failed to list API keys", { error, tenantId });
      return [];
    }
  }

  /**
   * Revoke API key
   */
  async revokeKey(keyId: string): Promise<void> {
    try {
      await this.prisma.apiKeyV2.update({
        where: { id: keyId },
        data: {
          active: false,
        },
      });

      logger.info("API key revoked", { keyId });
    } catch (error) {
      logger.error("Failed to revoke API key", { error, keyId });
      throw error;
    }
  }

  /**
   * Get leak detection alerts
   */
  async getLeakDetectionAlerts(tenantId: string): Promise<
    Array<{
      keyId: string;
      detectedAt: Date;
      source: string;
      severity: string;
      status: string;
    }>
  > {
    try {
      const leaks = await this.prisma.leakedApiKey.findMany({
        where: { tenantId },
        orderBy: { detectedAt: "desc" },
        take: 100,
      });

      return leaks.map((l) => ({
        keyId: l.apiKeyId,
        detectedAt: l.detectedAt,
        source: l.detectionSource,
        severity: l.severity,
        status: l.actionTaken,
      }));
    } catch (error) {
      logger.error("Failed to get leak alerts", { error, tenantId });
      return [];
    }
  }

  private hashKey(key: string): string {
    return createHash("sha256").update(key).digest("hex");
  }

  private randomString(length: number): string {
    return randomBytes(Math.ceil(length / 2))
      .toString("hex")
      .slice(0, length);
  }

  private mapToScopedApiKey(key: any): ScopedApiKey {
    return {
      id: key.id,
      keyPrefix: key.keyPrefix,
      keyHash: key.keyHash,
      scopes: (key.scopes || "").split(",").filter(Boolean) as ApiKeyScope[],
      name: key.name,
      lastUsedAt: key.lastUsedAt,
      lastUsedIp: key.lastUsedIp,
      active: key.active,
      rotationStatus: key.rotationInProgress ? "rotating" : "active",
      nextRotationRequired: key.nextRotationRequiredAt,
      createdAt: key.createdAt,
    };
  }

  private async detectAnomalousUsage(keyId: string, ipAddress: string): Promise<void> {
    try {
      const key = await this.prisma.apiKeyV2.findUnique({
        where: { id: keyId },
      });

      if (!key || !key.lastUsedIp) return;

      // Simple IP change detection
      if (key.lastUsedIp !== ipAddress) {
        logger.warn("Anomalous API key usage detected", {
          keyId,
          previousIp: key.lastUsedIp,
          newIp: ipAddress,
        });

        // Could trigger additional security checks here
        // e.g., require additional auth, rate limit, etc.
      }
    } catch (error) {
      logger.error("Failed to detect anomalous usage", { error, keyId });
    }
  }
}

export const createApiKeySecurityService = (prisma: PrismaClient) => new ApiKeySecurityService(prisma);
