/**
 * Per-Conversation Mutex via Redis SETNX.
 *
 * Problem: Der ursprüngliche Code nutzte `let isTextMessageInFlight` per Socket.
 * Ein User mit zwei Browser-Tabs konnte zwei parallele LLM-Calls auf der
 * gleichen Conversation starten — Konflikte beim Persistieren der Messages,
 * doppelte Token-Kosten, race conditions im History-Read.
 *
 * Lösung: Redis-Lock pro Conversation. Lock-Owner wird mit einer Token-UUID
 * identifiziert (Lua-Skript verhindert, dass ein anderer Owner unlocked).
 *
 * Auto-expire (default 60s) verhindert Deadlocks bei Crashes.
 */

import { randomUUID } from "node:crypto";
import { redis } from "../cache/redis.js";
import { logger } from "../../config/logger.js";

const LOCK_PREFIX = "ws:lock:conv:";
const DEFAULT_TTL_MS = 60_000;

const UNLOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

const RENEW_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
else
  return 0
end
`;

export interface ConversationLock {
  release: () => Promise<void>;
  renew: (ttlMs?: number) => Promise<boolean>;
  owner: string;
}

/**
 * Try to acquire a conversation lock. Returns null if already held by someone else.
 */
export async function tryLockConversation(
  conversationId: string,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<ConversationLock | null> {
  const key = `${LOCK_PREFIX}${conversationId}`;
  const owner = randomUUID();

  try {
    const acquired = await redis.set(key, owner, "PX", ttlMs, "NX");
    if (acquired !== "OK") {
      return null;
    }
  } catch (error) {
    logger.warn({ error: (error as Error).message, conversationId }, "WS mutex acquire failed");
    return null;
  }

  return {
    owner,
    async release() {
      try {
        await redis.eval(UNLOCK_LUA, 1, key, owner);
      } catch (error) {
        logger.warn({ error: (error as Error).message, conversationId }, "WS mutex release failed");
      }
    },
    async renew(renewMs: number = DEFAULT_TTL_MS) {
      try {
        const result = await redis.eval(RENEW_LUA, 1, key, owner, String(renewMs));
        return result === 1;
      } catch (error) {
        logger.warn({ error: (error as Error).message, conversationId }, "WS mutex renew failed");
        return false;
      }
    },
  };
}

/**
 * Convenience helper: run `fn` while holding the lock. Returns null if lock
 * is busy. Auto-renews every TTL/3 ms in case the LLM call takes long.
 */
export async function withConversationLock<T>(
  conversationId: string,
  fn: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T | null> {
  const lock = await tryLockConversation(conversationId, ttlMs);
  if (!lock) return null;

  const renewer = setInterval(() => {
    void lock.renew(ttlMs);
  }, Math.max(2_000, Math.floor(ttlMs / 3)));

  try {
    return await fn();
  } finally {
    clearInterval(renewer);
    await lock.release();
  }
}
