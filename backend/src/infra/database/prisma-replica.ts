/**
 * Read-Replica Prisma Client
 *
 * When DATABASE_REPLICA_URL is set, analytics and other read-heavy
 * queries are routed to a read replica to reduce load on the primary.
 *
 * If no replica URL is configured, this module transparently falls back
 * to the primary client — zero code changes required in callers.
 *
 * Usage:
 *   import { prismaReadOnly } from "@/infra/database/prisma-replica.js";
 *   const data = await prismaReadOnly.conversation.findMany(...);
 *
 * Setup (Render.com / any provider):
 *   1. Provision a read replica in your DB dashboard
 *   2. Set DATABASE_REPLICA_URL=<replica-connection-string> in env vars
 *   3. Deploy — routing is automatic
 *
 * GIN index for Hybrid Search full-text (run once on primary; replicates automatically):
 *   CREATE INDEX CONCURRENTLY idx_kc_fts
 *   ON "KnowledgeChunk" USING GIN (to_tsvector('english', "chunkText"));
 */

import { PrismaClient } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "./prisma.js";
import { logger } from "../../config/logger.js";

let _replicaClient: PrismaClient | null = null;

function createReplicaClient(): PrismaClient {
  const client = new PrismaClient({
    datasources: { db: { url: env.DATABASE_REPLICA_URL } },
    log: ["warn", "error"],
  });

  logger.info("Read-replica Prisma client initialised");
  return client;
}

/**
 * Returns a Prisma client pointed at the read replica.
 * Falls back to the primary client when DATABASE_REPLICA_URL is not set.
 */
export function getReplicaClient(): PrismaClient {
  if (!env.DATABASE_REPLICA_URL) {
    return prisma;
  }

  if (!_replicaClient) {
    _replicaClient = createReplicaClient();
  }

  return _replicaClient;
}

/**
 * Pre-built singleton for import ergonomics.
 * Equivalent to calling getReplicaClient() on each use.
 */
export const prismaReadOnly: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getReplicaClient() as unknown as Record<string, unknown>)[prop as string];
  },
});

export async function disconnectReplica(): Promise<void> {
  if (_replicaClient) {
    await _replicaClient.$disconnect();
    _replicaClient = null;
    logger.info("Read-replica Prisma client disconnected");
  }
}
