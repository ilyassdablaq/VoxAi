import nodemailer, { Transporter } from "nodemailer";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

interface ContactNotificationPayload {
  name: string;
  email: string;
  company?: string;
  message: string;
  createdAt: Date;
}

export class EmailService {
  private transporter: Transporter | null = null;
  private readonly receiverEmail: string | null;
  private readonly fromEmail: string | null;
  private readonly isConfigured: boolean;

  constructor() {
    this.receiverEmail = env.CONTACT_RECEIVER_EMAIL ?? null;
    this.fromEmail = env.SMTP_FROM ?? env.SMTP_USER ?? null;
    this.isConfigured =
      Boolean(env.SMTP_HOST) &&
      Boolean(env.SMTP_PORT) &&
      Boolean(env.SMTP_USER) &&
      Boolean(env.SMTP_PASS) &&
      Boolean(this.receiverEmail) &&
      Boolean(this.fromEmail);

    if (!this.isConfigured) {
      logger.warn("SMTP not fully configured. Contact emails will not be sent, only stored in database.");
      return;
    }

    const secure = env.SMTP_SECURE ?? env.SMTP_PORT === 465;

    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST!,
      port: env.SMTP_PORT!,
      secure,
      auth: {
        user: env.SMTP_USER!,
        pass: env.SMTP_PASS!,
      },
    });

    void this.transporter
      .verify()
      .then(() => {
        logger.info("SMTP transport verified and ready");
      })
      .catch((error) => {
        logger.error({ err: error }, "SMTP transport verification failed");
      });
  }

  async sendContactNotification(payload: ContactNotificationPayload): Promise<void> {
    if (!this.transporter || !this.receiverEmail || !this.fromEmail) {
      return;
    }

    await this.transporter.sendMail({
      from: this.fromEmail,
      to: this.receiverEmail,
      replyTo: payload.email,
      subject: `New contact request from ${payload.name}`,
      text: [
        `Name: ${payload.name}`,
        `Email: ${payload.email}`,
        `Company: ${payload.company || "-"}`,
        `Created At: ${payload.createdAt.toISOString()}`,
        "",
        "Message:",
        payload.message,
      ].join("\n"),
    });
  }
}

export const emailService = new EmailService();
