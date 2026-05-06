/**
 * E-Mail-Verifizierung — Token-Generierung, -Validierung und Resend-Cooldown.
 *
 * Token-Format: 32 random Bytes hex (256 Bit). Wird vor Speicherung gehasht
 * (SHA-256). Nutzer bekommt das Klartext-Token im Verify-Link, DB hält nur Hash.
 *
 * Resend-Cooldown: 60s pro User (Redis), schützt vor Mail-Flood.
 */

import { createHash, randomBytes } from "node:crypto";
import { redis } from "../../infra/cache/redis.js";
import { prisma } from "../../infra/database/prisma.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../../common/errors/app-error.js";
import { emailService } from "../../services/email/email.service.js";

const VERIFICATION_TOKEN_TTL_HOURS = 24;
const RESEND_COOLDOWN_SECONDS = 60;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function buildVerifyUrl(token: string): string {
  const url = new URL("/verify-email", env.APP_ORIGIN);
  url.searchParams.set("token", token);
  return url.toString();
}

export class EmailVerificationService {
  async issueAndSend(input: { userId: string; email: string }): Promise<void> {
    // 1. Cooldown check
    const cooldownKey = `email-verify:cooldown:${input.userId}`;
    const onCooldown = await redis.get(cooldownKey);
    if (onCooldown) {
      const ttl = await redis.ttl(cooldownKey);
      throw new AppError(
        429,
        "EMAIL_VERIFICATION_COOLDOWN",
        `Please wait ${Math.max(1, ttl)}s before requesting another verification email.`,
      );
    }

    // 2. Generate token, persist hash
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_HOURS * 3600 * 1000);

    await prisma.user.update({
      where: { id: input.userId },
      data: {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: expiresAt,
      },
    });

    // 3. Send email (best-effort; throws bubble up to route)
    const verifyUrl = buildVerifyUrl(rawToken);
    try {
      await emailService.sendVerificationEmail({
        email: input.email,
        verifyLink: verifyUrl,
      });
    } catch (error) {
      logger.error({ error, userId: input.userId }, "Failed to send verification email");
      throw new AppError(502, "VERIFICATION_EMAIL_FAILED", "Could not send verification email. Try again later.");
    }

    // 4. Set cooldown
    await redis.set(cooldownKey, "1", "EX", RESEND_COOLDOWN_SECONDS);

    logger.info({ userId: input.userId, email: input.email }, "Verification email dispatched");
  }

  async verify(token: string): Promise<{ userId: string; email: string }> {
    if (!token || token.length < 16) {
      throw new AppError(400, "INVALID_VERIFICATION_TOKEN", "Verification token is invalid");
    }

    const tokenHash = hashToken(token);
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: { gt: new Date() },
      },
      select: { id: true, email: true, emailVerifiedAt: true },
    });

    if (!user) {
      throw new AppError(400, "INVALID_VERIFICATION_TOKEN", "Verification link is invalid or expired");
    }

    if (user.emailVerifiedAt) {
      // Idempotent — token wird trotzdem invalidiert
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null,
        },
      });
      return { userId: user.id, email: user.email };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      },
    });

    logger.info({ userId: user.id, email: user.email }, "Email verified");
    return { userId: user.id, email: user.email };
  }

  async isVerified(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerifiedAt: true },
    });
    return Boolean(user?.emailVerifiedAt);
  }
}

export const emailVerificationService = new EmailVerificationService();
