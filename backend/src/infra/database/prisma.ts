import { PrismaClient } from "@prisma/client";
import { logger } from "../../config/logger.js";

export const prisma = new PrismaClient({
  log: ["warn", "error"],
});

async function ensureCriticalTables(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "OutboxEvent" (
      "id" TEXT NOT NULL,
      "aggregateId" TEXT NOT NULL,
      "aggregateType" TEXT NOT NULL,
      "eventType" TEXT NOT NULL,
      "payload" JSONB NOT NULL,
      "isPublished" BOOLEAN NOT NULL DEFAULT false,
      "publishedAt" TIMESTAMP(3),
      "failureCount" INTEGER NOT NULL DEFAULT 0,
      "lastError" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AuditLog" (
      "id" TEXT NOT NULL,
      "userId" TEXT,
      "principalType" TEXT NOT NULL,
      "principalId" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "resourceType" TEXT NOT NULL,
      "resourceId" TEXT NOT NULL,
      "changes" JSONB,
      "status" TEXT NOT NULL DEFAULT 'success',
      "errorMessage" TEXT,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "OutboxEvent_isPublished_createdAt_idx"
    ON "OutboxEvent" ("isPublished", "createdAt");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "OutboxEvent_aggregateType_aggregateId_idx"
    ON "OutboxEvent" ("aggregateType", "aggregateId");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx"
    ON "AuditLog" ("userId", "createdAt");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx"
    ON "AuditLog" ("action", "createdAt");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AuditLog_resourceType_resourceId_idx"
    ON "AuditLog" ("resourceType", "resourceId");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AuditLog_principalType_principalId_idx"
    ON "AuditLog" ("principalType", "principalId");
  `);
}

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  try {
    await ensureCriticalTables();
  } catch (error) {
    logger.warn({ error }, "Failed to ensure critical tables; continuing startup");
  }
  logger.info("Database connected");
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info("Database disconnected");
}
