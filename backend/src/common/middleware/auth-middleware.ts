import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../errors/app-error.js";

export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    const accessToken = (request as FastifyRequest & { cookies?: { accessToken?: string } }).cookies?.accessToken;

    if (!accessToken) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid or missing authentication token");
    }

    request.user = (await request.server.jwt.verify(accessToken)) as FastifyRequest["user"];
  } catch {
    throw new AppError(401, "UNAUTHORIZED", "Invalid or missing authentication token");
  }
}

export function authorize(roles: Array<"USER" | "ADMIN">) {
  return async function roleGuard(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const user = request.user as { role?: "USER" | "ADMIN" } | undefined;

    if (!user?.role || !roles.includes(user.role)) {
      throw new AppError(403, "FORBIDDEN", "Insufficient permissions");
    }
  };
}
