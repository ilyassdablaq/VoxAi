/**
 * Global presence tracking via Redis sorted sets.
 *
 * Use cases:
 *   - "Is this user currently connected?" (admin tools, presence indicators)
 *   - Targeted disconnect (e.g. on subscription downgrade or auth-revoke)
 *   - Operational metrics (connections per region, fan-out estimation)
 *
 * Storage:
 *   ws:presence:user:{userId} → ZSET<connectionId, lastHeartbeatMs>
 *   ws:presence:instance:{instanceId} → ZSET<connectionId, lastHeartbeatMs>
 *
 * Stale entries are pruned via ZREMRANGEBYSCORE on heartbeat (anything older
 * than 2× heartbeat interval is considered dead).
 */

import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { redis } from "../cache/redis.js";
import { logger } from "../../config/logger.js";

const HEARTBEAT_INTERVAL_MS = 25_000;
const STALE_AFTER_MS = 60_000;
const INSTANCE_ID = `${hostname()}:${process.pid}:${Date.now().toString(36)}`;

function userKey(userId: string): string {
  return `ws:presence:user:${userId}`;
}
function instanceKey(): string {
  return `ws:presence:instance:${INSTANCE_ID}`;
}

export interface PresenceHandle {
  connectionId: string;
  release: () => Promise<void>;
  heartbeat: () => Promise<void>;
}

export async function registerPresence(userId: string): Promise<PresenceHandle> {
  const connectionId = randomUUID();
  const now = Date.now();

  try {
    await redis
      .multi()
      .zadd(userKey(userId), now, connectionId)
      .zadd(instanceKey(), now, `${userId}:${connectionId}`)
      .expire(userKey(userId), 86_400)
      .expire(instanceKey(), 86_400)
      .exec();
  } catch (error) {
    logger.warn({ error: (error as Error).message, userId }, "WS presence register failed");
  }

  const heartbeat = async () => {
    const ts = Date.now();
    try {
      await redis
        .multi()
        .zadd(userKey(userId), ts, connectionId)
        .zadd(instanceKey(), ts, `${userId}:${connectionId}`)
        .zremrangebyscore(userKey(userId), 0, ts - STALE_AFTER_MS)
        .exec();
    } catch (error) {
      logger.debug({ error: (error as Error).message }, "WS presence heartbeat failed");
    }
  };

  const release = async () => {
    try {
      await redis
        .multi()
        .zrem(userKey(userId), connectionId)
        .zrem(instanceKey(), `${userId}:${connectionId}`)
        .exec();
    } catch (error) {
      logger.warn({ error: (error as Error).message, userId }, "WS presence release failed");
    }
  };

  return { connectionId, release, heartbeat };
}

/**
 * Active connection count for a user across the cluster.
 */
export async function countUserConnections(userId: string): Promise<number> {
  const cutoff = Date.now() - STALE_AFTER_MS;
  try {
    await redis.zremrangebyscore(userKey(userId), 0, cutoff);
    return await redis.zcard(userKey(userId));
  } catch {
    return 0;
  }
}

export const PRESENCE_HEARTBEAT_INTERVAL_MS = HEARTBEAT_INTERVAL_MS;
