import { Resend } from "resend";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

interface ContactNotificationPayload {
  name: string;
  email: string;
  company?: string;
  message: string;
  createdAt: Date;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export class EmailService {
  private client: Resend | null = null;
  private readonly receiverEmail: string | null;
  private readonly fromEmail: string | null;
  private readonly isConfigured: boolean;

  constructor() {
    this.receiverEmail = env.CONTACT_RECEIVER_EMAIL ?? null;
    this.fromEmail = env.EMAIL_FROM ?? null;
    this.isConfigured = Boolean(env.RESEND_API_KEY) && Boolean(this.fromEmail);

    if (!this.isConfigured) {
      logger.warn("Resend not fully configured. Emails will not be sent, only stored in database.");
      return;
    }

    this.client = new Resend(env.RESEND_API_KEY);
    logger.info("Resend email client configured");
  }

  async sendContactNotification(payload: ContactNotificationPayload): Promise<void> {
    if (!this.client || !this.receiverEmail || !this.fromEmail) {
      return;
    }

    await this.client.emails.send({
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
      html: [
        `<p><strong>Name:</strong> ${escapeHtml(payload.name)}</p>`,
        `<p><strong>Email:</strong> ${escapeHtml(payload.email)}</p>`,
        `<p><strong>Company:</strong> ${escapeHtml(payload.company || "-")}</p>`,
        `<p><strong>Created At:</strong> ${payload.createdAt.toISOString()}</p>`,
        "<hr />",
        `<p style=\"white-space: pre-wrap;\">${escapeHtml(payload.message)}</p>`,
      ].join(""),
    });
  }

  async sendPasswordResetEmail(payload: { email: string; resetLink: string }): Promise<void> {
    if (!this.client || !this.fromEmail) {
      return;
    }

    await this.client.emails.send({
      from: this.fromEmail,
      to: payload.email,
      subject: "Reset your VoxFlow password",
      text: [
        "We received a request to reset your password.",
        `Reset your password: ${payload.resetLink}`,
        "This link expires in 1 hour.",
        "If you did not request this, you can ignore this email.",
      ].join("\n\n"),
      html: [
        "<div style=\"font-family: Arial, sans-serif; color: #111; line-height: 1.5;\">",
        "<h2 style=\"margin-bottom: 12px;\">Reset your password</h2>",
        "<p>We received a request to reset your password.</p>",
        `<p><a href=\"${escapeHtml(payload.resetLink)}\" style=\"display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:6px;\">Reset password</a></p>`,
        `<p>If the button does not work, use this link:<br /><a href=\"${escapeHtml(payload.resetLink)}\">${escapeHtml(payload.resetLink)}</a></p>`,
        "<p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>",
        "</div>",
      ].join(""),
    });
  }
}

export const emailService = new EmailService();
