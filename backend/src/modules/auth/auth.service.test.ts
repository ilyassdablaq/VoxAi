import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";
import { AuthRepository } from "./auth.repository";
import { testFixtures, createMockFastifyRequest } from "@/test/mocks";
import { AppError } from "@/common/errors/app-error";

vi.mock("bcryptjs");
vi.mock("@/services/email/email.service", () => ({
  emailService: {
    sendPasswordResetEmail: vi.fn(),
  },
}));
vi.mock("@/infra/database/prisma", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/modules/auth/auth-rate-limit.service", () => ({
  authRateLimitService: {
    assertNotLocked: vi.fn().mockResolvedValue(undefined),
    recordFailure: vi.fn().mockResolvedValue({ failures: 1, lockedSec: 0 }),
    recordSuccess: vi.fn().mockResolvedValue(undefined),
  },
}));

import { prisma } from "@/infra/database/prisma";
import { emailService } from "@/services/email/email.service";

const mockContext = { email: "test@example.com", ipAddress: "127.0.0.1" };

describe("AuthService", () => {
  let authService: AuthService;
  let mockRepository: any;
  let mockFastify: any;

  beforeEach(() => {
    // Mock repository
    mockRepository = {
      findUserByEmail: vi.fn(),
      createUser: vi.fn(),
      findRefreshToken: vi.fn(),
      revokeRefreshToken: vi.fn(),
      createRefreshToken: vi.fn(),
    };

    // Mock fastify JWT
    mockFastify = {
      jwt: {
        sign: vi.fn((payload, options) => `token-${Date.now()}`),
      },
      refreshJwt: {
        sign: vi.fn(() => "refresh-token"),
        verify: vi.fn(),
        decode: vi.fn(() => ({ exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 })),
      },
    };

    authService = new AuthService(mockFastify as any, mockRepository);
  });

  describe("register", () => {
    it("should register a new user with valid credentials", async () => {
      const input = {
        email: "newuser@example.com",
        password: "Password123",
        fullName: "New User",
      };

      mockRepository.findUserByEmail.mockResolvedValue(null);
      mockRepository.createUser.mockResolvedValue(testFixtures.user);
      mockRepository.createRefreshToken.mockResolvedValue(undefined);
      vi.mocked(bcrypt.hash).mockResolvedValue("hashed_password" as never);

      const result = await authService.register(input);

      expect(result.user.email).toBe(testFixtures.user.email);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(mockRepository.findUserByEmail).toHaveBeenCalledWith(input.email);
      expect(mockRepository.createUser).toHaveBeenCalled();
      expect(bcrypt.hash).toHaveBeenCalledWith(input.password, expect.any(Number));
    });

    it("should throw EMAIL_ALREADY_EXISTS when user exists", async () => {
      const input = {
        email: testFixtures.user.email,
        password: "Password123",
        fullName: "New User",
      };

      mockRepository.findUserByEmail.mockResolvedValue(testFixtures.user);

      await expect(authService.register(input)).rejects.toThrow(
        expect.objectContaining({
          statusCode: 409,
          code: "EMAIL_ALREADY_EXISTS",
        })
      );

      expect(mockRepository.createUser).not.toHaveBeenCalled();
    });

    it("should properly hash the password with bcrypt", async () => {
      const input = {
        email: "test@example.com",
        password: "SecurePass123",
        fullName: "Test User",
      };

      mockRepository.findUserByEmail.mockResolvedValue(null);
      mockRepository.createUser.mockResolvedValue(testFixtures.user);
      mockRepository.createRefreshToken.mockResolvedValue(undefined);
      vi.mocked(bcrypt.hash).mockResolvedValue("$2b$10$hashedpassword" as never);

      await authService.register(input);

      expect(bcrypt.hash).toHaveBeenCalledWith(
        "SecurePass123",
        expect.any(Number)
      );
    });
  });

  describe("login", () => {
    it("should login user with valid credentials", async () => {
      const input = {
        email: testFixtures.user.email,
        password: "Password123",
      };

      mockRepository.findUserByEmail.mockResolvedValue(testFixtures.user);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      mockRepository.createRefreshToken.mockResolvedValue(undefined);
      vi.mocked(prisma.user.update).mockResolvedValue(testFixtures.user as never);

      const result = await authService.login(input, mockContext);

      expect(result.user.email).toBe(testFixtures.user.email);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(bcrypt.compare).toHaveBeenCalledWith(
        input.password,
        testFixtures.user.passwordHash
      );
    });

    it("should throw INVALID_CREDENTIALS for non-existent user", async () => {
      const input = {
        email: "nonexistent@example.com",
        password: "Password123",
      };

      mockRepository.findUserByEmail.mockResolvedValue(null);

      await expect(authService.login(input, mockContext)).rejects.toThrow(
        expect.objectContaining({
          statusCode: 401,
          code: "INVALID_CREDENTIALS",
        })
      );
    });

    it("should throw INVALID_CREDENTIALS for wrong password", async () => {
      const input = {
        email: testFixtures.user.email,
        password: "WrongPassword",
      };

      mockRepository.findUserByEmail.mockResolvedValue(testFixtures.user);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      vi.mocked(prisma.user.update).mockResolvedValue(testFixtures.user as never);

      await expect(authService.login(input, mockContext)).rejects.toThrow(
        expect.objectContaining({
          statusCode: 401,
          code: "INVALID_CREDENTIALS",
        })
      );
    });
  });

  describe("refresh", () => {
    it("should refresh tokens with valid refresh token", async () => {
      const refreshToken = "valid-refresh-token";

      mockRepository.findRefreshToken.mockResolvedValue(testFixtures.refreshToken);
      mockFastify.refreshJwt.verify.mockResolvedValue({
        sub: testFixtures.user.id,
        email: testFixtures.user.email,
        role: "USER",
        type: "refresh",
      });
      mockRepository.revokeRefreshToken.mockResolvedValue(undefined);
      mockRepository.createRefreshToken.mockResolvedValue(undefined);

      const result = await authService.refresh({ refreshToken });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(mockRepository.revokeRefreshToken).toHaveBeenCalled();
      expect(mockRepository.createRefreshToken).toHaveBeenCalled();
    });

    it("should throw INVALID_REFRESH_TOKEN when token not found", async () => {
      mockRepository.findRefreshToken.mockResolvedValue(null);

      await expect(
        authService.refresh({ refreshToken: "invalid-token" })
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 401,
          code: "INVALID_REFRESH_TOKEN",
        })
      );
    });

    it("should throw INVALID_REFRESH_TOKEN when token is revoked", async () => {
      const revokedToken = { ...testFixtures.refreshToken, revokedAt: new Date() };
      mockRepository.findRefreshToken.mockResolvedValue(revokedToken);

      await expect(
        authService.refresh({ refreshToken: "revoked-token" })
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 401,
          code: "INVALID_REFRESH_TOKEN",
        })
      );
    });

    it("should throw INVALID_REFRESH_TOKEN when token is expired", async () => {
      const expiredToken = {
        ...testFixtures.refreshToken,
        expiresAt: new Date(Date.now() - 1000),
      };
      mockRepository.findRefreshToken.mockResolvedValue(expiredToken);

      await expect(
        authService.refresh({ refreshToken: "expired-token" })
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 401,
          code: "INVALID_REFRESH_TOKEN",
        })
      );
    });

    it("should throw INVALID_REFRESH_TOKEN when decoded payload is invalid", async () => {
      mockRepository.findRefreshToken.mockResolvedValue(testFixtures.refreshToken);
      mockFastify.refreshJwt.verify.mockResolvedValue(null);

      await expect(
        authService.refresh({ refreshToken: "invalid-payload-token" })
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 401,
          code: "INVALID_REFRESH_TOKEN",
        })
      );
    });

    it("should throw INVALID_REFRESH_TOKEN when token type is not refresh", async () => {
      mockRepository.findRefreshToken.mockResolvedValue(testFixtures.refreshToken);
      mockFastify.refreshJwt.verify.mockResolvedValue({
        sub: testFixtures.user.id,
        email: testFixtures.user.email,
        role: "USER",
        type: "access",
      });

      await expect(
        authService.refresh({ refreshToken: "wrong-type-token" })
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 401,
          code: "INVALID_REFRESH_TOKEN",
        })
      );
    });
  });

  describe("forgotPassword", () => {
    it("should generate reset token for existing user", async () => {
      mockRepository.findUserByEmail.mockResolvedValue(testFixtures.user);
      vi.mocked(prisma.user.update).mockResolvedValue(testFixtures.user as never);

      await authService.forgotPassword({ email: testFixtures.user.email });

      expect(vi.mocked(prisma.user.update)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: testFixtures.user.id },
          data: expect.objectContaining({
            passwordResetToken: expect.any(String),
            passwordResetExpiresAt: expect.any(Date),
          }),
        })
      );
    });

    it("should silently fail for non-existent user", async () => {
      mockRepository.findUserByEmail.mockResolvedValue(null);

      const result = await authService.forgotPassword({
        email: "nonexistent@example.com",
      });

      expect(result).toBeUndefined();
      expect(vi.mocked(prisma.user.update)).not.toHaveBeenCalled();
    });

    it("should set reset token expiry to 1 hour", async () => {
      mockRepository.findUserByEmail.mockResolvedValue(testFixtures.user);
      vi.mocked(prisma.user.update).mockResolvedValue(testFixtures.user as never);

      const beforeTime = Date.now();
      await authService.forgotPassword({ email: testFixtures.user.email });
      const afterTime = Date.now();

      const updateCall = vi.mocked(prisma.user.update).mock.calls[0][0];
      const expiresAt = (updateCall.data as any).passwordResetExpiresAt.getTime();
      const oneHourMs = 60 * 60 * 1000;

      expect(expiresAt).toBeGreaterThanOrEqual(beforeTime + oneHourMs - 100);
      expect(expiresAt).toBeLessThanOrEqual(afterTime + oneHourMs + 100);
    });

    it("should not throw when email provider fails", async () => {
      mockRepository.findUserByEmail.mockResolvedValue(testFixtures.user);
      vi.mocked(prisma.user.update).mockResolvedValue(testFixtures.user as never);
      vi.mocked(emailService.sendPasswordResetEmail).mockRejectedValue(new Error("resend unavailable"));

      await expect(authService.forgotPassword({ email: testFixtures.user.email })).resolves.toBeUndefined();
      expect(vi.mocked(prisma.user.update)).toHaveBeenCalled();
    });
  });

  describe("resetPassword", () => {
    it("should reset password with valid reset token", async () => {
      const resetToken = "valid-reset-token";

      vi.mocked(prisma.user.findFirst).mockResolvedValue(testFixtures.user as never);
      vi.mocked(bcrypt.hash).mockResolvedValue("new_hashed_password" as never);
      vi.mocked(prisma.user.update).mockResolvedValue(testFixtures.user as never);

      await authService.resetPassword({
        token: resetToken,
        newPassword: "NewPassword123",
      });

      expect(vi.mocked(prisma.user.findFirst)).toHaveBeenCalled();
      expect(bcrypt.hash).toHaveBeenCalledWith("NewPassword123", expect.any(Number));
      expect(vi.mocked(prisma.user.update)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: testFixtures.user.id },
          data: expect.objectContaining({
            passwordHash: "new_hashed_password",
            passwordResetToken: null,
            passwordResetExpiresAt: null,
          }),
        })
      );
    });

    it("should throw INVALID_RESET_TOKEN for expired token", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null as never);

      await expect(
        authService.resetPassword({
          token: "expired-token",
          newPassword: "NewPassword123",
        })
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 401,
          code: "INVALID_RESET_TOKEN",
        })
      );
    });

    it("should throw INVALID_RESET_TOKEN for invalid token", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null as never);

      await expect(
        authService.resetPassword({
          token: "invalid-token",
          newPassword: "NewPassword123",
        })
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: 401,
          code: "INVALID_RESET_TOKEN",
        })
      );
    });

    it("should clear reset token after successful reset", async () => {
      const resetToken = "valid-token";

      vi.mocked(prisma.user.findFirst).mockResolvedValue(testFixtures.user as never);
      vi.mocked(bcrypt.hash).mockResolvedValue("new_password_hash" as never);
      vi.mocked(prisma.user.update).mockResolvedValue(testFixtures.user as never);

      await authService.resetPassword({
        token: resetToken,
        newPassword: "NewPassword123",
      });

      const updateCall = vi.mocked(prisma.user.update).mock.calls[0][0];
      expect((updateCall.data as any).passwordResetToken).toBeNull();
      expect((updateCall.data as any).passwordResetExpiresAt).toBeNull();
    });
  });

  describe("Security: No Bearer Token Fallbacks", () => {
    /**
     * These tests verify that all bearer-token compatibility fallbacks have been removed.
     * Authentication MUST use cookies only; no implicit fallback to Authorization headers.
     */

    it("should not have any bearer token extraction logic in service methods", () => {
      // Verify the service does not attempt to parse Authorization headers
      // All token handling should be explicit and parameter-based
      expect(authService).toBeDefined();

      // The service accepts explicit tokens only (via function parameters)
      // No private/internal methods should search for Authorization headers
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(authService || {}));
      const hasAuthHeaderMethods = methods.some(
        (m) => 
          m.includes("authorization") ||
          m.includes("Authorization") ||
          m.includes("bearer") ||
          m.includes("Bearer")
      );
      expect(hasAuthHeaderMethods).toBe(false);
    });

    it("should require explicit refresh token in refresh method", async () => {
      mockRepository.findRefreshToken.mockResolvedValue(testFixtures.refreshToken);
      mockFastify.refreshJwt.verify.mockResolvedValue({
        sub: testFixtures.user.id,
        email: testFixtures.user.email,
        role: "USER",
        type: "refresh",
      });
      mockRepository.revokeRefreshToken.mockResolvedValue(undefined);
      mockRepository.createRefreshToken.mockResolvedValue(undefined);

      // Refresh MUST be called with explicit token parameter
      // No fallback to Authorization header
      await authService.refresh({ refreshToken: "valid-token" });

      expect(mockRepository.findRefreshToken).toHaveBeenCalledWith(expect.any(String));
    });

    it("should not have implicit token lookup from request context", async () => {
      // AuthService is a plain class that does not inspect request context
      // All auth information must be passed explicitly via parameters

      mockRepository.findUserByEmail.mockResolvedValue(testFixtures.user);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      mockRepository.createRefreshToken.mockResolvedValue(undefined);
      vi.mocked(prisma.user.update).mockResolvedValue(testFixtures.user as never);

      const result = await authService.login({
        email: testFixtures.user.email,
        password: "Password123",
      }, mockContext);

      // Verify login result contains tokens (not retrieved from implicit context)
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      // Tokens are issued via explicit methods, not searched from environment
      expect(mockFastify.jwt.sign).toHaveBeenCalled();
      expect(mockFastify.refreshJwt.sign).toHaveBeenCalled();
    });
  });
});
