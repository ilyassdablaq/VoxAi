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

interface PasswordResetPayload {
  email: string;
  resetLink: string;
}

interface VerificationPayload {
  email: string;
  verifyLink: string;
}

interface TestEmailPayload {
  triggeredBy: string;
}

function escapeHtml(value: string): string {
  const htmlEscapeMap: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return value.replace(/[&<>"']/g, (char) => htmlEscapeMap[char] ?? char);
}

export class EmailService {
  private readonly client: Resend | null;
  private readonly receiverEmail: string | null;
  private readonly fromEmail: string | null;
  private readonly testToEmail: string | null;

  constructor() {
    this.receiverEmail = env.CONTACT_RECEIVER_EMAIL ?? null;
    this.fromEmail = env.EMAIL_FROM ?? null;
    this.testToEmail = env.EMAIL_TEST_TO ?? null;

    if (!env.RESEND_API_KEY || !this.fromEmail) {
      this.client = null;

      if (env.NODE_ENV === "test") {
        logger.debug("Resend disabled in test environment due to missing key or sender");
        return;
      }

      throw new Error("Email service misconfigured: RESEND_API_KEY and EMAIL_FROM are required");
    }

    this.client = new Resend(env.RESEND_API_KEY);

    const keyPreview = `${env.RESEND_API_KEY.slice(0, 3)}...${env.RESEND_API_KEY.slice(-4)}`;
    logger.info(
      {
        resendApiKeyPreview: keyPreview,
        hasContactReceiver: Boolean(this.receiverEmail),
        hasTestRecipient: Boolean(this.testToEmail),
      },
      "Resend email client configured",
    );
  }

  private ensureClient(): Resend {
    if (!this.client) {
      throw new Error("Resend client unavailable. Configure RESEND_API_KEY and EMAIL_FROM");
    }

    return this.client;
  }

  private async sendEmail(
    kind: "contact_notification" | "password_reset" | "integration_test" | "email_verification",
    payload: Parameters<Resend["emails"]["send"]>[0],
  ): Promise<string> {
    if (!this.client && env.NODE_ENV === "test") {
      logger.debug({ emailKind: kind }, "Skipping outbound email in test environment");
      return "test-noop";
    }

    const client = this.ensureClient();

    try {
      const response = await client.emails.send(payload);

      if (response.error) {
        logger.error(
          {
            emailKind: kind,
            resendError: response.error,
          },
          "Resend API returned an error",
        );

        throw new Error(`Resend API error: ${response.error.message ?? "unknown"}`);
      }

      const providerMessageId = response.data?.id ?? "unknown";
      logger.info({ emailKind: kind, providerMessageId }, "Email request sent successfully via Resend");
      return providerMessageId;
    } catch (error) {
      logger.error({ err: error, emailKind: kind }, "Failed to send email via Resend");
      throw error;
    }
  }

  async sendContactNotification(payload: ContactNotificationPayload): Promise<string> {
    if (!this.receiverEmail) {
      throw new Error("Email service misconfigured: CONTACT_RECEIVER_EMAIL is required for contact notifications");
    }

    return this.sendEmail("contact_notification", {
      from: this.fromEmail as string,
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
        `<p style="white-space: pre-wrap;">${escapeHtml(payload.message)}</p>`,
      ].join(""),
    });
  }

  async sendPasswordResetEmail(payload: PasswordResetPayload): Promise<string> {
    return this.sendEmail("password_reset", {
      from: this.fromEmail as string,
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
        `<p><a href="${escapeHtml(payload.resetLink)}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">Reset password</a></p>`,
        `<p>If the button does not work, use this link:<br /><a href="${escapeHtml(payload.resetLink)}">${escapeHtml(payload.resetLink)}</a></p>`,
        "<p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>",
        "</div>",
      ].join(""),
    });
  }

  async sendVerificationEmail(payload: VerificationPayload): Promise<string> {
    return this.sendEmail("email_verification", {
      from: this.fromEmail as string,
      to: payload.email,
      subject: "Verify your VoxAI email address",
      text: [
        "Welcome to VoxAI!",
        "Please verify your email address by visiting the link below:",
        payload.verifyLink,
        "This link expires in 24 hours.",
        "If you did not create a VoxAI account, you can safely ignore this email.",
      ].join("\n\n"),
      html: [
        "<div style=\"font-family: Arial, sans-serif; color: #111; line-height: 1.5;\">",
        "<h2 style=\"margin-bottom: 12px;\">Verify your email address</h2>",
        "<p>Welcome to VoxAI! Please confirm your email address to activate your account.</p>",
        `<p><a href="${escapeHtml(payload.verifyLink)}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">Verify email</a></p>`,
        `<p>If the button does not work, paste this link into your browser:<br /><a href="${escapeHtml(payload.verifyLink)}">${escapeHtml(payload.verifyLink)}</a></p>`,
        "<p>This link expires in 24 hours. If you did not create a VoxAI account, you can safely ignore this email.</p>",
        "</div>",
      ].join(""),
    });
  }

  async sendIntegrationTestEmail(payload: TestEmailPayload): Promise<string> {
    if (!this.testToEmail) {
      throw new Error("Email service misconfigured: EMAIL_TEST_TO is required for integration test email");
    }

    const sentAt = new Date().toISOString();

    return this.sendEmail("integration_test", {
      from: this.fromEmail as string,
      to: this.testToEmail,
      subject: "VoxAI Resend integration test",
      text: [
        "This is a Resend integration test email from VoxAI backend.",
        `Triggered by: ${payload.triggeredBy}`,
        `Sent at: ${sentAt}`,
      ].join("\n"),
      html: [
        "<div style=\"font-family: Arial, sans-serif; color: #111; line-height: 1.5;\">",
        "<h2>Resend integration test</h2>",
        "<p>This is a Resend integration test email from VoxAI backend.</p>",
        `<p><strong>Triggered by:</strong> ${escapeHtml(payload.triggeredBy)}</p>`,
        `<p><strong>Sent at:</strong> ${sentAt}</p>`,
        "</div>",
      ].join(""),
    });
  }
}

export const emailService = new EmailService();
