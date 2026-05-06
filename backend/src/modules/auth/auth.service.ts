import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";
import { AuthRepository } from "./auth.repository.js";
import { LoginInput, RefreshInput, RegisterInput, ForgotPasswordInput, ResetPasswordInput } from "./auth.schemas.js";
import { prisma } from "../../infra/database/prisma.js";
import { logger } from "../../config/logger.js";
import { emailService } from "../../services/email/email.service.js";
import { authRateLimitService, AuthAttemptContext } from "./auth-rate-limit.service.js";
import { emailVerificationService } from "./email-verification.service.js";

function isPrismaRefreshTokenStorageError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as { code?: string }).code;
  // P2021: table missing, P2022: column missing, P2023: inconsistent column data.
  return code === "P2021" || code === "P2022" || code === "P2023";
}

export class AuthService {
  constructor(
    private readonly fastify: FastifyInstance,
    private readonly repository: AuthRepository,
  ) {}

  private get refreshJwtApi() {
    const root = this.fastify as any;
    const namespaced = root.jwt?.refreshJwt ?? root.jwt?.refresh;
    return namespaced ?? root.refreshJwt;
  }

  private get refreshJwtSign() {
    const candidate = this.refreshJwtApi?.sign;
    if (typeof candidate !== "function") {
      throw new AppError(500, "TOKEN_ISSUE_FAILED", "Refresh token signer is not configured");
    }

    return candidate as (payload: Record<string, unknown>, options?: Record<string, unknown>) => string;
  }

  private get refreshJwtVerify() {
    const candidate = this.refreshJwtApi?.verify;
    if (typeof candidate !== "function") {
      throw new AppError(500, "TOKEN_ISSUE_FAILED", "Refresh token verifier is not configured");
    }

    return candidate as (token: string) => Promise<Record<string, unknown>>;
  }

  private get refreshJwtDecode() {
    const candidate = this.refreshJwtApi?.decode;
    if (typeof candidate !== "function") {
      throw new AppError(500, "TOKEN_ISSUE_FAILED", "Refresh token decoder is not configured");
    }

    return candidate as (token: string) => { exp?: number } | null;
  }

  async register(payload: RegisterInput, _context?: AuthAttemptContext) {
    const existingUser = await this.repository.findUserByEmail(payload.email);
    if (existingUser) {
      throw new AppError(409, "EMAIL_ALREADY_EXISTS", "A user with this email already exists");
    }

    const passwordHash = await bcrypt.hash(payload.password, env.BCRYPT_SALT_ROUNDS);
    const user = await this.repository.createUser({
      email: payload.email,
      fullName: payload.fullName,
      passwordHash,
    });

    // Verifizierungs-Mail anstoßen (best-effort: Registrierung soll nicht
    // an Email-Provider-Hicksern scheitern).
    try {
      await emailVerificationService.issueAndSend({ userId: user.id, email: user.email });
    } catch (error) {
      logger.warn(
        { err: error, userId: user.id },
        "Could not send verification email at registration; user must request resend",
      );
    }

    const tokens = await this.issueTokens({ id: user.id, email: user.email, role: user.role });
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        emailVerified: false,
      },
      ...tokens,
    };
  }

  async login(payload: LoginInput, context: AuthAttemptContext) {
    // 1. Rate-Limit-Vorabprüfung
    await authRateLimitService.assertNotLocked(context);

    // 2. User suchen — bei Nichtfund trotzdem failure-counter setzen,
    //    sonst gibt der Server eine Timing-side-channel preis (existing email).
    const user = await this.repository.findUserByEmail(payload.email);
    if (!user) {
      await authRateLimitService.recordFailure(context);
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    // 3. Lockout am DB-User (für persistente Sperren über Redis-Restart hinweg)
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const retryAfterSec = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
      throw new AppError(429, "AUTH_LOCKED", `Account locked. Try again in ${retryAfterSec}s.`, { retryAfterSec });
    }

    const isPasswordValid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!isPasswordValid) {
      const result = await authRateLimitService.recordFailure(context);

      // Persistierten Lockout am User setzen, wenn Schwelle hoch genug
      if (result.lockedSec > 0) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: { increment: 1 },
            lockedUntil: new Date(Date.now() + result.lockedSec * 1000),
          },
        });
      } else {
        await prisma.user
          .update({
            where: { id: user.id },
            data: { failedLoginAttempts: { increment: 1 } },
          })
          .catch(() => undefined);
      }

      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    // 4. Erfolg → Counter resetten + lastLogin tracken
    await authRateLimitService.recordSuccess(context);
    await prisma.user
      .update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
        },
      })
      .catch(() => undefined);

    const tokens = await this.issueTokens({ id: user.id, email: user.email, role: user.role });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        emailVerified: Boolean(user.emailVerifiedAt),
      },
      ...tokens,
    };
  }

  async refresh(payload: RefreshInput) {
    const refreshTokenHash = this.hashToken(payload.refreshToken);
    const stored = await this.repository.findRefreshToken(refreshTokenHash);

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired");
    }

    let verifiedPayload: { sub?: string; email?: string; role?: "USER" | "ADMIN"; type?: string } | null;
    try {
      verifiedPayload = (await this.refreshJwtVerify(payload.refreshToken)) as {
        sub?: string;
        email?: string;
        role?: "USER" | "ADMIN";
        type?: string;
      } | null;
    } catch {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired");
    }

    if (
      !verifiedPayload ||
      !verifiedPayload.sub ||
      !verifiedPayload.email ||
      !verifiedPayload.role ||
      verifiedPayload.type !== "refresh"
    ) {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token payload is invalid");
    }

    await this.repository.revokeRefreshToken(refreshTokenHash);

    return this.issueTokens({
      id: verifiedPayload.sub,
      email: verifiedPayload.email,
      role: verifiedPayload.role,
    });
  }

  private async issueTokens(user: { id: string; email: string; role: "USER" | "ADMIN" }) {
    const accessToken = this.fastify.jwt.sign(
      { email: user.email, role: user.role },
      {
        sub: user.id,
        expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      },
    );

    const refreshToken = this.refreshJwtSign(
      { email: user.email, role: user.role, type: "refresh", jti: randomUUID() },
      {
        sub: user.id,
        expiresIn: env.JWT_REFRESH_EXPIRES_IN,
      },
    );

    const refreshTokenHash = this.hashToken(refreshToken);
    const decodedRefresh = this.refreshJwtDecode(refreshToken);
    if (!decodedRefresh?.exp) {
      throw new AppError(500, "TOKEN_ISSUE_FAILED", "Failed to determine refresh token expiry");
    }
    const expiresAt = new Date(decodedRefresh.exp * 1000);

    try {
      await this.repository.createRefreshToken({
        tokenHash: refreshTokenHash,
        userId: user.id,
        expiresAt,
      });
    } catch (error) {
      logger.error({ err: error, userId: user.id }, "Failed to persist refresh token");

      if (!isPrismaRefreshTokenStorageError(error)) {
        throw error;
      }

      // Degrade gracefully so login/register stay available during schema drift incidents.
      logger.warn(
        { userId: user.id },
        "Refresh token storage unavailable; continuing without persisted refresh token",
      );
    }

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  async forgotPassword(payload: ForgotPasswordInput) {
    const user = await this.repository.findUserByEmail(payload.email);
    if (!user) {
      logger.debug({ email: payload.email }, "Forgot password request for non-existent email");
      return;
    }

    const resetToken = randomBytes(32).toString("hex");
    const resetTokenHash = this.hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetTokenHash,
        passwordResetExpiresAt: expiresAt,
      },
    });

    const resetPath = env.RESET_PASSWORD_PATH.startsWith("/")
      ? env.RESET_PASSWORD_PATH
      : `/${env.RESET_PASSWORD_PATH}`;
    const resetUrl = new URL(resetPath, env.APP_ORIGIN);
    resetUrl.searchParams.set("token", resetToken);

    try {
      await emailService.sendPasswordResetEmail({
        email: user.email,
        resetLink: resetUrl.toString(),
      });
    } catch (error) {
      logger.error({ error, email: user.email }, "Failed to send password reset email");
    }

    logger.info({ email: user.email }, "Password reset token issued");
  }

  async resetPassword(payload: ResetPasswordInput) {
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: this.hashToken(payload.token),
        passwordResetExpiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new AppError(401, "INVALID_RESET_TOKEN", "Reset token is invalid or expired");
    }

    const passwordHash = await bcrypt.hash(payload.newPassword, env.BCRYPT_SALT_ROUNDS);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });

    logger.info({ email: user.email }, "Password reset successfully");
  }
}
