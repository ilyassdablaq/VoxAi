/**
 * Auth-spezifischer Brute-Force-Schutz.
 *
 * Strategie: 3 unabhängige Counter
 *   1. per-email     → schützt einzelne Accounts
 *   2. per-ip        → schützt vor Account-Spraying (verschiedene Mails, eine IP)
 *   3. per-ip+email  → finegrained Lock-Trigger für gezielte Angriffe
 *
 * Lockout-Eskalation (geometrisch, basiert auf gewähltem Counter):
 *   ≤4 Fehler → keine Sperre
 *   5–9      → 1 min lockout
 *   10–14    → 5 min
 *   15–19    → 30 min
 *   ≥20      → 60 min
 *
 * Erfolgreicher Login resettet alle drei Counter für den User.
 */

import { redis } from "../../infra/cache/redis.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../../common/errors/app-error.js";

const COUNTER_TTL_SECONDS = 60 * 60; // 1h sliding window
const LOCKOUT_THRESHOLDS: Array<[min: number, lockoutSec: number]> = [
  [20, 60 * 60],
  [15, 30 * 60],
  [10, 5 * 60],
  [5, 60],
];

type CounterKind = "email" | "ip" | "combo";

function key(kind: CounterKind, identifier: string): string {
  return `auth:fail:${kind}:${identifier.toLowerCase()}`;
}

function lockKey(kind: CounterKind, identifier: string): string {
  return `auth:lock:${kind}:${identifier.toLowerCase()}`;
}

function calculateLockoutSeconds(fails: number): number {
  for (const [minFails, lockSec] of LOCKOUT_THRESHOLDS) {
    if (fails >= minFails) return lockSec;
  }
  return 0;
}

export interface AuthAttemptContext {
  email: string;
  ipAddress: string;
}

export class AuthRateLimitService {
  /**
   * MUSS *vor* dem Passwort-Check aufgerufen werden.
   * Wirft 429 wenn bereits gesperrt; sonst Pass.
   */
  async assertNotLocked(ctx: AuthAttemptContext): Promise<void> {
    const checks: Array<[CounterKind, string]> = [
      ["email", ctx.email],
      ["ip", ctx.ipAddress],
      ["combo", `${ctx.ipAddress}|${ctx.email}`],
    ];

    for (const [kind, id] of checks) {
      const ttl = await redis.pttl(lockKey(kind, id)).catch(() => -2);
      if (ttl > 0) {
        const retryAfterSec = Math.ceil(ttl / 1000);
        logger.warn({ kind, id, retryAfterSec }, "Login attempt blocked: account locked");
        throw new AppError(
          429,
          "AUTH_LOCKED",
          `Too many failed attempts. Try again in ${retryAfterSec}s.`,
          { retryAfterSec, lockReason: kind },
        );
      }
    }
  }

  /**
   * Nach fehlgeschlagenem Login aufrufen. Inkrementiert alle 3 Counter
   * und setzt ggf. einen Lockout.
   */
  async recordFailure(ctx: AuthAttemptContext): Promise<{ failures: number; lockedSec: number }> {
    const counters: Array<[CounterKind, string]> = [
      ["email", ctx.email],
      ["ip", ctx.ipAddress],
      ["combo", `${ctx.ipAddress}|${ctx.email}`],
    ];

    let maxFails = 0;
    let appliedLockSec = 0;

    for (const [kind, id] of counters) {
      try {
        const failures = await redis.incr(key(kind, id));
        if (failures === 1) {
          await redis.expire(key(kind, id), COUNTER_TTL_SECONDS);
        }
        if (failures > maxFails) maxFails = failures;

        const lockSec = calculateLockoutSeconds(failures);
        if (lockSec > 0) {
          await redis.set(lockKey(kind, id), "1", "EX", lockSec);
          if (lockSec > appliedLockSec) appliedLockSec = lockSec;
        }
      } catch (error) {
        logger.warn({ error: (error as Error).message, kind, id }, "Auth rate-limit increment failed");
      }
    }

    if (appliedLockSec > 0) {
      logger.warn(
        { email: ctx.email, ipAddress: ctx.ipAddress, failures: maxFails, lockedSec: appliedLockSec },
        "Auth lockout triggered",
      );
    }

    return { failures: maxFails, lockedSec: appliedLockSec };
  }

  /**
   * Nach erfolgreichem Login aufrufen. Reset für email + combo (nicht ip,
   * da dort auch andere Accounts laufen können).
   */
  async recordSuccess(ctx: AuthAttemptContext): Promise<void> {
    try {
      await redis.del(
        key("email", ctx.email),
        key("combo", `${ctx.ipAddress}|${ctx.email}`),
        lockKey("email", ctx.email),
        lockKey("combo", `${ctx.ipAddress}|${ctx.email}`),
      );
    } catch (error) {
      logger.warn({ error: (error as Error).message }, "Auth rate-limit reset failed");
    }
  }

  /**
   * Manuelle Entsperrung durch Admin/User (z.B. per Reset-Password-Flow).
   */
  async unlockEmail(email: string): Promise<void> {
    const stream = redis.scanStream({ match: `auth:lock:*:${email.toLowerCase()}*`, count: 50 });
    const pipeline = redis.pipeline();
    let queued = 0;
    for await (const keys of stream) {
      for (const k of keys as string[]) {
        pipeline.del(k);
        queued++;
      }
    }
    if (queued > 0) {
      await pipeline.exec();
      logger.info({ email, keysCleared: queued }, "Auth locks cleared for email");
    }
  }
}

export const authRateLimitService = new AuthRateLimitService();
