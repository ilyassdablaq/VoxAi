import { PrismaClient } from "@prisma/client";
import { createSloService, SloService } from "../monitoring/slo.service.js";
import { createBillingSafetyService, BillingSafetyService } from "../billing/billing-safety.service.js";
import { createDataLifecycleService, DataLifecycleService } from "../data-lifecycle/data-lifecycle.service.js";
import { createApiKeySecurityService, ApiKeySecurityService } from "../security/api-key-security.service.js";
import { createWebhookReplayService, WebhookReplayService } from "../webhook-management/webhook-replay.service.js";
import { createRegressionSuiteService, RegressionSuiteService } from "../ai-regression/regression-suite.service.js";

export interface EnhancedServices {
  slo: SloService;
  billingSafety: BillingSafetyService;
  dataLifecycle: DataLifecycleService;
  apiKeySecurity: ApiKeySecurityService;
  webhookReplay: WebhookReplayService;
  regressionSuite: RegressionSuiteService;
}

export function createEnhancedServices(prisma: PrismaClient): EnhancedServices {
  return {
    slo: createSloService(prisma),
    billingSafety: createBillingSafetyService(prisma),
    dataLifecycle: createDataLifecycleService(prisma),
    apiKeySecurity: createApiKeySecurityService(prisma),
    webhookReplay: createWebhookReplayService(prisma),
    regressionSuite: createRegressionSuiteService(prisma),
  };
}

// Global singleton
let enhancedServices: EnhancedServices | null = null;

export function getEnhancedServices(prisma: PrismaClient): EnhancedServices {
  if (!enhancedServices) {
    enhancedServices = createEnhancedServices(prisma);
  }
  return enhancedServices;
}
