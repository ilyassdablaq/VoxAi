import { FastifyInstance } from "fastify";
import { validate } from "../../common/middleware/validate.js";
import { AuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";
import { LoginInput, RefreshInput, RegisterInput, ForgotPasswordInput, ResetPasswordInput, loginSchema, refreshSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from "./auth.schemas.js";
import { auditLogService } from "../../common/services/audit-log.service.js";


export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const authService = new AuthService(fastify, new AuthRepository());

  fastify.post("/api/auth/register", { preHandler: [validate({ body: registerSchema })] }, async (request, reply) => {
    try {
      const result = await authService.register(request.body as RegisterInput);
      
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

  fastify.post("/api/auth/login", { preHandler: [validate({ body: loginSchema })] }, async (request) => {
    try {
      const result = await authService.login(request.body as LoginInput);
      
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

  fastify.post("/api/auth/refresh", { preHandler: [validate({ body: refreshSchema })] }, async (request) => {
    return authService.refresh(request.body as RefreshInput);
  });

  fastify.post("/api/auth/forgot-password", { preHandler: [validate({ body: forgotPasswordSchema })] }, async (request, reply) => {
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

  fastify.post("/api/auth/reset-password", { preHandler: [validate({ body: resetPasswordSchema })] }, async (request, reply) => {
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
