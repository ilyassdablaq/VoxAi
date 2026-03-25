import { FastifyInstance } from "fastify";
import { validate } from "../../common/middleware/validate.js";
import { AuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";
import { LoginInput, RefreshInput, RegisterInput, ForgotPasswordInput, ResetPasswordInput, loginSchema, refreshSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from "./auth.schemas.js";


export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const authService = new AuthService(fastify, new AuthRepository());

  fastify.post("/api/auth/register", { preHandler: [validate({ body: registerSchema })] }, async (request, reply) => {
    const result = await authService.register(request.body as RegisterInput);
    return reply.status(201).send(result);
  });

  fastify.post("/api/auth/login", { preHandler: [validate({ body: loginSchema })] }, async (request) => {
    return authService.login(request.body as LoginInput);
  });

  fastify.post("/api/auth/refresh", { preHandler: [validate({ body: refreshSchema })] }, async (request) => {
    return authService.refresh(request.body as RefreshInput);
  });

  fastify.post("/api/auth/forgot-password", { preHandler: [validate({ body: forgotPasswordSchema })] }, async (request, reply) => {
    await authService.forgotPassword(request.body as ForgotPasswordInput);
    return reply.status(200).send({ message: "Reset email sent if account exists" });
  });

  fastify.post("/api/auth/reset-password", { preHandler: [validate({ body: resetPasswordSchema })] }, async (request, reply) => {
    await authService.resetPassword(request.body as ResetPasswordInput);
    return reply.status(200).send({ message: "Password reset successfully" });
  });
}
