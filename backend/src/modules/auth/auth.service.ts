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

export class AuthService {
  constructor(
    private readonly fastify: FastifyInstance,
    private readonly repository: AuthRepository,
  ) {}

  async register(payload: RegisterInput) {
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

    const tokens = await this.issueTokens({ id: user.id, email: user.email, role: user.role });
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      ...tokens,
    };
  }

  async login(payload: LoginInput) {
    const user = await this.repository.findUserByEmail(payload.email);
    if (!user) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    const tokens = await this.issueTokens({ id: user.id, email: user.email, role: user.role });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
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

    const decoded = this.fastify.jwt.decode(payload.refreshToken) as { sub: string; email: string; role: "USER" | "ADMIN" } | null;
    if (!decoded?.sub || !decoded?.email || !decoded?.role) {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token payload is invalid");
    }

    await this.repository.revokeRefreshToken(refreshTokenHash);

    return this.issueTokens({
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
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

    const refreshToken = this.fastify.jwt.sign(
      { email: user.email, role: user.role, type: "refresh", jti: randomUUID() },
      {
        sub: user.id,
        expiresIn: env.JWT_REFRESH_EXPIRES_IN,
      },
    );

    const refreshTokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.repository.createRefreshToken({
      tokenHash: refreshTokenHash,
      userId: user.id,
      expiresAt,
    });

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
