import { Queue, Worker, JobsOptions } from "bullmq";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

type QueueName = "transcription" | "webhook" | "aiTasks" | "outbox" | "deadLetter";

const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 1000,
  },
  removeOnComplete: 100,
  removeOnFail: 500,
};

const bullConnection = {
  url: env.REDIS_URL,
};

type EnqueueOptions = {
  idempotencyKey?: string;
  attempts?: number;
  delayMs?: number;
};

export const transcriptionQueue = new Queue("transcription", {
  connection: bullConnection,
  defaultJobOptions,
});

export const webhookQueue = new Queue("webhook", {
  connection: bullConnection,
  defaultJobOptions,
});

export const aiTasksQueue = new Queue("aiTasks", {
  connection: bullConnection,
  defaultJobOptions,
});

export const outboxQueue = new Queue("outbox", {
  connection: bullConnection,
  defaultJobOptions,
});

export const deadLetterQueue = new Queue("deadLetter", {
  connection: bullConnection,
  defaultJobOptions: {
    removeOnComplete: 200,
    removeOnFail: 1000,
  },
});

export async function enqueueWithPolicy(
  queue: Queue,
  name: string,
  data: Record<string, unknown>,
  options?: EnqueueOptions,
) {
  return queue.add(name, data, {
    ...defaultJobOptions,
    attempts: options?.attempts ?? defaultJobOptions.attempts,
    delay: options?.delayMs,
    jobId: options?.idempotencyKey,
  });
}

export function startWorkers(): Worker[] {
  const workers: Array<{ name: QueueName; worker: Worker }> = [
    {
      name: "transcription",
      worker: new Worker(
        "transcription",
        async (job) => {
          logger.info({ jobId: job.id, payload: job.data }, "Processing transcription job");
        },
        { connection: bullConnection },
      ),
    },
    {
      name: "webhook",
      worker: new Worker(
        "webhook",
        async (job) => {
          logger.info({ jobId: job.id, payload: job.data }, "Delivering webhook event");
        },
        { connection: bullConnection },
      ),
    },
    {
      name: "aiTasks",
      worker: new Worker(
        "aiTasks",
        async (job) => {
          logger.info({ jobId: job.id, payload: job.data }, "Processing async AI task");
        },
        { connection: bullConnection },
      ),
    },
    {
      name: "outbox",
      worker: new Worker(
        "outbox",
        async (job) => {
          logger.info({ jobId: job.id, payload: job.data }, "Processing outbox event");
          const eventData = job.data as {
            eventId?: string;
            eventType?: string;
            aggregateId?: string;
            userId?: string;
            payload?: Record<string, unknown>;
          };

          await enqueueWithPolicy(
            webhookQueue,
            eventData.eventType ?? "domain-event",
            {
              eventId: eventData.eventId,
              aggregateId: eventData.aggregateId,
              userId: eventData.userId,
              payload: eventData.payload ?? {},
            },
            { idempotencyKey: eventData.eventId },
          );
        },
        { connection: bullConnection },
      ),
    },
    {
      name: "deadLetter",
      worker: new Worker(
        "deadLetter",
        async (job) => {
          logger.warn({ jobId: job.id, payload: job.data }, "Dead-letter job recorded");
        },
        { connection: bullConnection },
      ),
    },
  ];

  for (const { name, worker } of workers) {
    worker.on("failed", (job, error) => {
      logger.error({ queue: name, jobId: job?.id, error }, "Queue job failed");

      if (!job || name === "deadLetter") {
        return;
      }

      const maxAttempts = job.opts.attempts ?? defaultJobOptions.attempts ?? 1;
      if (job.attemptsMade >= maxAttempts) {
        void enqueueWithPolicy(
          deadLetterQueue,
          `${name}.${job.name}`,
          {
            sourceQueue: name,
            sourceJobId: job.id,
            attemptsMade: job.attemptsMade,
            failedReason: job.failedReason,
            payload: job.data,
            failedAt: new Date().toISOString(),
          },
          { idempotencyKey: `${name}:${String(job.id)}:${job.attemptsMade}` },
        );
      }
    });
  }

  return workers.map((item) => item.worker);
}
