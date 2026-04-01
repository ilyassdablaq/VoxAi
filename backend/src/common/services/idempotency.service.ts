import { createHash, randomUUID } from "node:crypto";
import { AppError } from "../errors/app-error.js";
import { redis } from "../../infra/cache/redis.js";

const DEFAULT_REPLAY_TTL_SECONDS = 60 * 60;
const DEFAULT_LOCK_TTL_SECONDS = 30;

type StoredIdempotentResponse<T> = {
  statusCode: number;
  body: T;
  createdAt: string;
};

function hashFallbackKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class IdempotencyService {
  resolveKey(explicitKey: string | undefined, fallbackParts: string[]): string {
    if (explicitKey && explicitKey.trim().length > 0) {
      return explicitKey.trim();
    }

    return hashFallbackKey(fallbackParts.join("|"));
  }

  async execute<T>(input: {
    scope: string;
    key: string;
    run: () => Promise<{ statusCode: number; body: T }>;
    replayTtlSeconds?: number;
    lockTtlSeconds?: number;
  }): Promise<{ replayed: boolean; statusCode: number; body: T }> {
    const replayTtlSeconds = input.replayTtlSeconds ?? DEFAULT_REPLAY_TTL_SECONDS;
    const lockTtlSeconds = input.lockTtlSeconds ?? DEFAULT_LOCK_TTL_SECONDS;
    const replayKey = `idem:replay:${input.scope}:${input.key}`;
    const lockKey = `idem:lock:${input.scope}:${input.key}`;

    const existing = await redis.get(replayKey);
    if (existing) {
      const parsed = JSON.parse(existing) as StoredIdempotentResponse<T>;
      return { replayed: true, statusCode: parsed.statusCode, body: parsed.body };
    }

    const lockValue = randomUUID();
    const lockAcquired = await redis.set(lockKey, lockValue, "EX", lockTtlSeconds, "NX");

    if (!lockAcquired) {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await sleep(150);
        const delayed = await redis.get(replayKey);
        if (delayed) {
          const parsed = JSON.parse(delayed) as StoredIdempotentResponse<T>;
          return { replayed: true, statusCode: parsed.statusCode, body: parsed.body };
        }
      }

      throw new AppError(409, "IDEMPOTENT_REQUEST_IN_PROGRESS", "A matching request is already in progress");
    }

    try {
      const result = await input.run();
      const payload: StoredIdempotentResponse<T> = {
        statusCode: result.statusCode,
        body: result.body,
        createdAt: new Date().toISOString(),
      };

      await redis.set(replayKey, JSON.stringify(payload), "EX", replayTtlSeconds);
      return { replayed: false, statusCode: result.statusCode, body: result.body };
    } finally {
      await redis.del(lockKey);
    }
  }
}

export const idempotencyService = new IdempotencyService();
