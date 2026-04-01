import type { Prisma } from "@prisma/client";
import { Webhook } from "svix";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { prisma } from "../../infra/database/prisma.js";

type ResendWebhookHeaders = {
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getRecipientEmail(to: unknown): string | null {
  if (Array.isArray(to)) {
    const firstRecipient = to.find((entry) => typeof entry === "string");
    return getString(firstRecipient);
  }

  return getString(to);
}

function mapEventToStatus(eventType: string): string {
  if (eventType.startsWith("email.delivered")) return "DELIVERED";
  if (eventType.startsWith("email.delivery_delayed")) return "DELAYED";
  if (eventType.startsWith("email.bounced")) return "BOUNCED";
  if (eventType.startsWith("email.complained")) return "COMPLAINED";
  if (eventType.startsWith("email.opened")) return "OPENED";
  if (eventType.startsWith("email.clicked")) return "CLICKED";
  if (eventType.startsWith("email.sent")) return "SENT";
  return "RECEIVED";
}

function resolveEventTimestamp(createdAt: unknown): Date {
  const raw = getString(createdAt);
  if (!raw) {
    return new Date();
  }

  const parsedDate = new Date(raw);
  return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
}

export class ResendWebhookService {
  private readonly provider = "resend";

  verifySignature(payload: string, headers: ResendWebhookHeaders): boolean {
    const webhookSecret = env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.warn("Resend webhook secret missing, signature verification cannot be performed");
      return false;
    }

    try {
      const webhook = new Webhook(webhookSecret);
      webhook.verify(payload, {
        "svix-id": headers.svixId,
        "svix-timestamp": headers.svixTimestamp,
        "svix-signature": headers.svixSignature,
      });
      return true;
    } catch (error) {
      logger.warn({ err: error }, "Resend webhook signature verification failed");
      return false;
    }
  }

  async persistDeliveryStatus(rawPayload: unknown): Promise<void> {
    if (!isRecord(rawPayload)) {
      logger.warn("Ignoring Resend webhook payload because it is not an object");
      return;
    }

    const eventType = getString(rawPayload.type) ?? "unknown";
    const eventTimestamp = resolveEventTimestamp(rawPayload.created_at);
    const data = isRecord(rawPayload.data) ? rawPayload.data : {};

    const providerMessageId = getString(data.email_id) ?? getString(data.id);
    if (!providerMessageId) {
      logger.warn({ eventType }, "Ignoring Resend webhook event without message id");
      return;
    }

    const recipientEmail = getRecipientEmail(data.to);
    const subject = getString(data.subject);
    const status = mapEventToStatus(eventType);

    await prisma.emailDeliveryStatus.upsert({
      where: {
        provider_providerMessageId: {
          provider: this.provider,
          providerMessageId,
        },
      },
      create: {
        provider: this.provider,
        providerMessageId,
        recipientEmail,
        subject,
        eventType,
        status,
        eventTimestamp,
        rawPayload: rawPayload as Prisma.InputJsonValue,
      },
      update: {
        recipientEmail,
        subject,
        eventType,
        status,
        eventTimestamp,
        attemptCount: {
          increment: 1,
        },
        rawPayload: rawPayload as Prisma.InputJsonValue,
      },
    });
  }
}

export const resendWebhookService = new ResendWebhookService();
