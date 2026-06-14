import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { initializeSentry, Sentry } from "./config/sentry.js";
import { connectDatabase, disconnectDatabase } from "./infra/database/prisma.js";
import { ensureVectorIndexes } from "./infra/database/ensure-indexes.js";
import { disconnectReplica } from "./infra/database/prisma-replica.js";
import { startWorkers } from "./infra/queue/queues.js";
import { redis, redisPublisher, redisSubscriber } from "./infra/cache/redis.js";
import { initializeWsBroker } from "./infra/ws/ws-broker.service.js";
import { closeRenderBrowser } from "./services/rag/headless-render.js";

async function bootstrap() {
  initializeSentry();

  process.on("unhandledRejection", (reason) => {
    Sentry.captureException(reason);
    logger.error({ err: reason }, "Unhandled promise rejection");
  });

  process.on("uncaughtException", (error) => {
    Sentry.captureException(error);
    logger.error({ err: error }, "Uncaught exception");
  });

  await connectDatabase();
  await ensureVectorIndexes();
  try {
    await initializeWsBroker();
  } catch (error) {
    Sentry.captureException(error);
    logger.warn({ error }, "WS broker initialization failed; continuing without Redis pub/sub");
  }
  const app = await buildApp();
  const isUpstash = env.REDIS_URL.includes("upstash.io");
  const shouldStartWorkers = env.QUEUE_WORKERS_ENABLED ?? !isUpstash;
  const workers = shouldStartWorkers ? startWorkers() : [];

  if (!shouldStartWorkers) {
    logger.warn("Queue workers disabled for this process (set QUEUE_WORKERS_ENABLED=true to enable)");
  }

  const closeGracefully = async () => {
    logger.info("Shutting down gracefully...");
    await app.close();
    await closeRenderBrowser();
    await Promise.all(workers.map((worker) => worker.close()));
    await disconnectDatabase();
    await disconnectReplica();
    await Promise.all([redis.quit(), redisPublisher.quit(), redisSubscriber.quit()]);
    await Sentry.close(2000);
    process.exit(0);
  };

  process.on("SIGINT", closeGracefully);
  process.on("SIGTERM", closeGracefully);

  try {
    await app.listen({
      host: env.HOST,
      port: env.PORT,
    });

    logger.info({ host: env.HOST, port: env.PORT }, "VoxAI backend is running");
  } catch (error) {
    Sentry.captureException(error);
    logger.error({ error }, "Failed to start server");
    await closeGracefully();
  }
}

void bootstrap();
