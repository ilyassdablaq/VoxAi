import { Redis, RedisOptions } from "ioredis";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  connectTimeout: 10000,
  retryStrategy(times) {
    return Math.min(times * 200, 2000);
  },
  reconnectOnError(error) {
    return /ECONNRESET|ETIMEDOUT|EPIPE|READONLY/i.test(error.message);
  },
};

function createRedisClient(name: "redis" | "redisPublisher" | "redisSubscriber") {
  const client = new Redis(env.REDIS_URL, redisOptions);

  client.on("error", (error) => {
    logger.warn({ client: name, error: error.message }, "Redis connection error");
  });

  client.on("ready", () => {
    logger.info({ client: name }, "Redis connection ready");
  });

  return client;
}

export const redis = createRedisClient("redis");

export const redisPublisher = createRedisClient("redisPublisher");

export const redisSubscriber = createRedisClient("redisSubscriber");
