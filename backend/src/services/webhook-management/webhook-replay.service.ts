import { PrismaClient } from "@prisma/client";
import { logger } from "../../config/logger.js";
import { queues } from "../../infra/queue/queues.js";

export type WebhookEventType =
  | "conversation.created"
  | "conversation.ended"
  | "message.received"
  | "message.sent"
  | "subscription.upgraded"
  | "subscription.canceled"
  | "webhook.delivered"
  | "webhook.failed";

export interface WebhookEventPayload {
  id: string;
  eventType: WebhookEventType;
  timestamp: string;
  tenantId: string;
  data: Record<string, any>;
}

export interface WebhookDeliveryLog {
  eventId: string;
  deliveryId: string;
  endpointUrl: string;
  status: "success" | "pending" | "failed";
  httpStatus?: number;
  responseTime?: number;
  deliveredAt?: Date;
  error?: string;
}

export class WebhookReplayService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Publish webhook event (stores in event store)
   */
  async publishEvent(
    tenantId: string,
    eventType: WebhookEventType,
    data: Record<string, any>,
  ): Promise<void> {
    try {
      const payload: WebhookEventPayload = {
        id: this.generateEventId(),
        eventType,
        timestamp: new Date().toISOString(),
        tenantId,
        data,
      };

      // Store in event log
      await this.prisma.webhookEvent.create({
        data: {
          tenantId,
          eventType,
          payload: payload as any,
          signatureVersion: 1,
          deliveryAttempts: 0,
          lastDeliveryStatus: "pending",
        },
      });

      // Queue for delivery
      await queues.webhookQueue.add(
        "send-webhook",
        {
          eventId: payload.id,
          tenantId,
          eventType,
          payload,
        },
        {
          // Default retry policy
          attempts: 5,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        },
      );

      logger.info("Webhook event published", { tenantId, eventType, eventId: payload.id });
    } catch (error) {
      logger.error("Failed to publish webhook event", { error, tenantId, eventType });
      throw error;
    }
  }

  /**
   * Get event history for tenant
   */
  async getEventHistory(
    tenantId: string,
    options?: {
      eventType?: WebhookEventType;
      limit?: number;
      offset?: number;
      fromDate?: Date;
      toDate?: Date;
    },
  ): Promise<Array<WebhookEventPayload & { id: string; createdAt: Date }>> {
    try {
      const events = await this.prisma.webhookEvent.findMany({
        where: {
          tenantId,
          eventType: options?.eventType,
          createdAt: {
            gte: options?.fromDate,
            lte: options?.toDate,
          },
        },
        orderBy: { createdAt: "desc" },
        take: options?.limit || 100,
        skip: options?.offset || 0,
      });

      return events.map((e) => ({
        ...(e.payload as any),
        id: e.id,
        createdAt: e.createdAt,
      }));
    } catch (error) {
      logger.error("Failed to get event history", { error, tenantId });
      return [];
    }
  }

  /**
   * Replay webhook event (resend to customer endpoints)
   */
  async replayEvent(eventId: string, tenantId: string): Promise<boolean> {
    try {
      const event = await this.prisma.webhookEvent.findUnique({
        where: { id: eventId },
      });

      if (!event || event.tenantId !== tenantId) {
        logger.warn("Event not found for replay", { eventId, tenantId });
        return false;
      }

      // Increment replay count
      await this.prisma.webhookEvent.update({
        where: { id: eventId },
        data: {
          replayCount: { increment: 1 },
          lastDeliveryStatus: "pending",
          deliveryAttempts: 0,
        },
      });

      // Re-queue for delivery
      await queues.webhookQueue.add(
        "send-webhook",
        {
          eventId,
          tenantId,
          eventType: event.eventType,
          payload: event.payload,
          isReplay: true,
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 1000,
          },
        },
      );

      logger.info("Webhook event replayed", { eventId, tenantId });
      return true;
    } catch (error) {
      logger.error("Failed to replay webhook event", { error, eventId });
      return false;
    }
  }

  /**
   * Get delivery dashboard for event
   */
  async getDeliveryDashboard(
    eventId: string,
    tenantId: string,
  ): Promise<{
    event: WebhookEventPayload & { createdAt: Date };
    deliveries: WebhookDeliveryLog[];
    summary: {
      successful: number;
      failed: number;
      pending: number;
    };
  } | null> {
    try {
      const event = await this.prisma.webhookEvent.findUnique({
        where: { id: eventId },
      });

      if (!event || event.tenantId !== tenantId) {
        return null;
      }

      const deliveries = await this.prisma.webhookDelivery.findMany({
        where: { webhookEventId: eventId },
        orderBy: { createdAt: "desc" },
      });

      const logs: WebhookDeliveryLog[] = deliveries.map((d) => ({
        eventId: d.webhookEventId,
        deliveryId: d.id,
        endpointUrl: d.endpointUrl,
        status: d.deliveredAt ? "success" : d.errorMessage ? "failed" : "pending",
        httpStatus: d.httpStatus || undefined,
        responseTime: d.responseTimeMs || undefined,
        deliveredAt: d.deliveredAt || undefined,
        error: d.errorMessage || undefined,
      }));

      const summary = {
        successful: logs.filter((l) => l.status === "success").length,
        failed: logs.filter((l) => l.status === "failed").length,
        pending: logs.filter((l) => l.status === "pending").length,
      };

      return {
        event: {
          ...(event.payload as any),
          createdAt: event.createdAt,
        },
        deliveries: logs,
        summary,
      };
    } catch (error) {
      logger.error("Failed to get delivery dashboard", { error, eventId });
      return null;
    }
  }

  /**
   * Record delivery attempt
   */
  async recordDeliveryAttempt(
    eventId: string,
    endpointUrl: string,
    success: boolean,
    httpStatus?: number,
    responseTime?: number,
    errorMessage?: string,
  ): Promise<void> {
    try {
      const delivery = await this.prisma.webhookDelivery.create({
        data: {
          webhookEventId: eventId,
          tenantId: (await this.prisma.webhookEvent.findUnique({ where: { id: eventId } }))
            ?.tenantId as string,
          endpointUrl,
          httpStatus,
          responseTimeMs: responseTime,
          errorMessage,
          deliveredAt: success ? new Date() : undefined,
        },
      });

      // Update event record
      const event = await this.prisma.webhookEvent.findUnique({
        where: { id: eventId },
      });

      if (event) {
        await this.prisma.webhookEvent.update({
          where: { id: eventId },
          data: {
            deliveryAttempts: event.deliveryAttempts + 1,
            lastDeliveryStatus: success ? "success" : "failed",
            lastDeliveryAttemptAt: new Date(),
            deliveredAt: success ? new Date() : undefined,
          },
        });
      }

      logger.info("Delivery attempt recorded", {
        eventId,
        endpointUrl,
        success,
        httpStatus,
      });
    } catch (error) {
      logger.error("Failed to record delivery attempt", { error, eventId });
    }
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(tenantId: string): Promise<{
    totalEvents: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageDeliveryTime: number;
    eventsByType: Record<string, number>;
  }> {
    try {
      const events = await this.prisma.webhookEvent.findMany({
        where: { tenantId },
      });

      const deliveries = await this.prisma.webhookDelivery.findMany({
        where: {
          webhookEvent: {
            tenantId,
          },
        },
      });

      const successful = deliveries.filter((d) => d.deliveredAt).length;
      const failed = deliveries.filter((d) => d.errorMessage).length;
      const avgTime =
        deliveries.filter((d) => d.responseTimeMs).reduce((sum, d) => sum + (d.responseTimeMs || 0), 0) /
          Math.max(deliveries.length, 1) || 0;

      const eventsByType: Record<string, number> = {};
      events.forEach((e) => {
        eventsByType[e.eventType] = (eventsByType[e.eventType] || 0) + 1;
      });

      return {
        totalEvents: events.length,
        successfulDeliveries: successful,
        failedDeliveries: failed,
        averageDeliveryTime: Math.round(avgTime),
        eventsByType,
      };
    } catch (error) {
      logger.error("Failed to get webhook stats", { error, tenantId });
      return {
        totalEvents: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        averageDeliveryTime: 0,
        eventsByType: {},
      };
    }
  }

  private generateEventId(): string {
    return `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const createWebhookReplayService = (prisma: PrismaClient) => new WebhookReplayService(prisma);
