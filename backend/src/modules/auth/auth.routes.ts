import { FastifyInstance, FastifyReply } from "fastify";
import { validate } from "../../common/middleware/validate.js";
import { AuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";
import { LoginInput, RefreshInput, RegisterInput, ForgotPasswordInput, ResetPasswordInput, loginSchema, refreshSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from "./auth.schemas.js";
import { auditLogService } from "../../common/services/audit-log.service.js";
import { AppError } from "../../common/errors/app-error.js";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? ("none" as const) : ("lax" as const),
  path: "/",
};

function applyAuthCookies(
  fastify: FastifyInstance,
  reply: FastifyReply,
  accessToken: string,
  refreshToken: string,
): void {
  const typedFastify = fastify as FastifyInstance & { refreshJwt: { decode: (token: string) => { exp?: number } | null } };
  const accessDecoded = typedFastify.jwt.decode(accessToken) as { exp?: number } | null;
  const refreshDecoded = typedFastify.refreshJwt.decode(refreshToken);

  if (!accessDecoded?.exp || !refreshDecoded?.exp) {
    throw new AppError(500, "TOKEN_ISSUE_FAILED", "Failed to determine auth cookie expiry");
  }

  reply.setCookie("accessToken", accessToken, {
    ...cookieOptions,
    expires: new Date(accessDecoded.exp * 1000),
  });
  reply.setCookie("refreshToken", refreshToken, {
    ...cookieOptions,
    expires: new Date(refreshDecoded.exp * 1000),
  });
}

function clearAuthCookies(reply: { clearCookie: (name: string, options: { path: string }) => unknown }): void {
  reply.clearCookie("accessToken", { path: "/" });
  reply.clearCookie("refreshToken", { path: "/" });
}


export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const authService = new AuthService(fastify, new AuthRepository());
  const noRateLimit = { config: { rateLimit: false } };

  fastify.post("/api/auth/register", { ...noRateLimit, preHandler: [validate({ body: registerSchema })] }, async (request, reply) => {
    try {
      const result = await authService.register(request.body as RegisterInput);
      applyAuthCookies(fastify, reply, result.accessToken, result.refreshToken);
      
      // Audit log
      await auditLogService.log({
        principalType: "system",
        principalId: "anonymous",
        action: "auth.register",
        resourceType: "user",
        resourceId: (result as any).userId || "unknown",
        status: "success",
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });

      return reply.status(201).send(result);
    } catch (error) {
      await auditLogService.log({
        principalType: "system",
        principalId: "anonymous",
        action: "auth.register",
        resourceType: "user",
        resourceId: "unknown",
        status: "failure",
        errorMessage: error instanceof Error ? error.message : String(error),
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });
      throw error;
    }
  });

  fastify.post("/api/auth/login", { ...noRateLimit, preHandler: [validate({ body: loginSchema })] }, async (request, reply) => {
    try {
      const result = await authService.login(request.body as LoginInput);
      applyAuthCookies(fastify, reply, result.accessToken, result.refreshToken);
      
      // Audit log
      await auditLogService.log({
        principalType: "system",
        principalId: "anonymous",
        action: "auth.login",
        resourceType: "user",
        resourceId: (result as any).userId || "unknown",
        status: "success",
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });

      return result;
    } catch (error) {
      await auditLogService.log({
        principalType: "system",
        principalId: "anonymous",
        action: "auth.login",
        resourceType: "user",
        resourceId: (request.body as LoginInput).email,
        status: "failure",
        errorMessage: error instanceof Error ? error.message : String(error),
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });
      throw error;
    }
  });

  fastify.post("/api/auth/refresh", noRateLimit, async (request, reply) => {
    const body = request.body as RefreshInput | undefined;
    const refreshToken = request.cookies?.refreshToken ?? body?.refreshToken;

    if (!refreshToken) {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired");
    }

    const result = await authService.refresh({ refreshToken });
    applyAuthCookies(fastify, reply, result.accessToken, result.refreshToken);
    return result;
  });

  fastify.post("/api/auth/logout", noRateLimit, async (_request, reply) => {
    clearAuthCookies(reply);
    return reply.status(204).send();
  });

  fastify.post("/api/auth/forgot-password", { ...noRateLimit, preHandler: [validate({ body: forgotPasswordSchema })] }, async (request, reply) => {
    try {
      await authService.forgotPassword(request.body as ForgotPasswordInput);
      
      await auditLogService.log({
        principalType: "system",
        principalId: "anonymous",
        action: "auth.forgot_password",
        resourceType: "user",
        resourceId: (request.body as ForgotPasswordInput).email,
        status: "success",
        ipAddress: request.ip,
      });

      return reply.status(200).send({ message: "Reset email sent if account exists" });
    } catch (error) {
      await auditLogService.log({
        principalType: "system",
        principalId: "anonymous",
        action: "auth.forgot_password",
        resourceType: "user",
        resourceId: (request.body as ForgotPasswordInput).email,
        status: "failure",
        errorMessage: error instanceof Error ? error.message : String(error),
        ipAddress: request.ip,
      });
      throw error;
    }
  });

  fastify.post("/api/auth/reset-password", { ...noRateLimit, preHandler: [validate({ body: resetPasswordSchema })] }, async (request, reply) => {
    try {
      await authService.resetPassword(request.body as ResetPasswordInput);
      
      await auditLogService.log({
        principalType: "system",
        principalId: "anonymous",
        action: "auth.reset_password",
        resourceType: "user",
        resourceId: "anonymous",
        status: "success",
        ipAddress: request.ip,
      });

      return reply.status(200).send({ message: "Password reset successfully" });
    } catch (error) {
      await auditLogService.log({
        principalType: "system",
        principalId: "anonymous",
        action: "auth.reset_password",
        resourceType: "user",
        resourceId: "anonymous",
        status: "failure",
        errorMessage: error instanceof Error ? error.message : String(error),
        ipAddress: request.ip,
      });
      throw error;
    }
  });
}
