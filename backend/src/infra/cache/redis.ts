import { Redis } from "ioredis";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

function createRedisClient(client: "redis" | "redisPublisher" | "redisSubscriber") {
  const instance = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    enableOfflineQueue: false,
    connectTimeout: 2000,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    retryStrategy(attempts) {
      return Math.min(attempts * 200, 2000);
    },
  });

  instance.on("error", (error) => {
    logger.warn({ client, error: error.message }, "Redis connection error");
  });

  instance.on("ready", () => {
    logger.info({ client }, "Redis connection ready");
  });

  instance.on("close", () => {
    logger.warn({ client }, "Redis connection closed");
  });

  return instance;
}

export const redis = createRedisClient("redis");
export const redisPublisher = createRedisClient("redisPublisher");
export const redisSubscriber = createRedisClient("redisSubscriber");
