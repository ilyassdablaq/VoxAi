import { logger } from "../../config/logger.js";
import { enqueueWithPolicy, outboxQueue } from "../../infra/queue/queues.js";
import { prisma } from "../../infra/database/prisma.js";

export type DomainEvent = {
  eventId: string;
  eventType: string;
  aggregateId?: string;
  aggregateType?: string;
  userId: string;
  payload: Record<string, unknown>;
  createdAt?: string;
};

/**
 * Publishes a domain event both to DB (Outbox) and Queue (for processing).
 * This provides durability and transactional guarantees.
 */
export async function publishDomainEvent(event: DomainEvent): Promise<void> {
  const createdAt = event.createdAt ?? new Date().toISOString();

  try {
    // 1. Persist to DB (Outbox table) - this is atomically transactional with the business operation
    const outboxEvent = await prisma.outboxEvent.create({
      data: {
        id: event.eventId,
        aggregateId: event.aggregateId || event.userId,
        aggregateType: event.aggregateType || "generic",
        eventType: event.eventType,
        payload: {
          ...event.payload,
          createdAt,
          userId: event.userId,
        },
        isPublished: false,
      },
    });

    // 2. Attempt async queue dispatch (best effort)
    await enqueueWithPolicy(
      outboxQueue,
      "domain-event",
      {
        ...event,
        createdAt,
        outboxEventId: outboxEvent.id,
      },
      {
        idempotencyKey: event.eventId,
      }
    );

    logger.debug(
      { eventId: event.eventId, eventType: event.eventType, userId: event.userId },
      "Domain event persisted to outbox (DB + queue)"
    );
  } catch (error) {
    logger.error(
      { error, eventId: event.eventId, eventType: event.eventType },
      "Failed to publish domain event"
    );
    throw error;
  }
}

/**
 * Worker: Process unpublished events from Outbox table and dispatch to webhooks/external systems
 */
export async function processOutboxEvents(batchSize: number = 100): Promise<number> {
  const events = await prisma.outboxEvent.findMany({
    where: { isPublished: false },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  if (events.length === 0) {
    return 0;
  }

  let processed = 0;

  for (const event of events) {
    try {
      // Attempt to enqueue for processing
      await enqueueWithPolicy(
        outboxQueue,
        "domain-event",
        event,
        {
          idempotencyKey: event.id,
          attempts: 5,
          delayMs: 5000,
        }
      );

      // Mark as published
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          isPublished: true,
          publishedAt: new Date(),
          failureCount: 0,
        },
      });

      processed++;
      logger.debug({ eventId: event.id, eventType: event.eventType }, "Outbox event processed");
    } catch (error) {
      const failureCount = event.failureCount + 1;
      const lastError = error instanceof Error ? error.message : String(error);

      // Update failure count and error message
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          failureCount,
          lastError,
        },
      });

      // Dead letter: give up after 10 failures
      if (failureCount >= 10) {
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: { isPublished: true, publishedAt: new Date() }, // Mark as "done" even if failed
        });
        logger.error(
          { eventId: event.id, eventType: event.eventType, failureCount, error: lastError },
          "Outbox event dead lettered after max retries"
        );
      }
    }
  }

  return processed;
}

/**
 * Get retry stats for monitoring/alerting
 */
export async function getOutboxStats() {
  const unpublished = await prisma.outboxEvent.count({
    where: { isPublished: false },
  });

  const failed = await prisma.outboxEvent.count({
    where: { isPublished: false, failureCount: { gt: 0 } },
  });

  const deadLettered = await prisma.outboxEvent.count({
    where: { failureCount: { gte: 10 } },
  });

  return { unpublished, failed, deadLettered };
}
