import { createHash } from "node:crypto";
import { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../infra/database/prisma.js";
import { AppError } from "../errors/app-error.js";

// Priority: Cookie JWT → Bearer JWT → API-Key (x-api-key header)
export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    const cookieToken = (request as FastifyRequest & { cookies?: { accessToken?: string } }).cookies?.accessToken;
    const authorizationHeader = request.headers.authorization;
    const bearerToken =
      typeof authorizationHeader === "string" && authorizationHeader.toLowerCase().startsWith("bearer ")
        ? authorizationHeader.slice(7).trim()
        : null;
    const accessToken = cookieToken || bearerToken;

    if (!accessToken) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid or missing authentication token");
    }

    request.user = (await request.server.jwt.verify(accessToken)) as FastifyRequest["user"];
  } catch {
    throw new AppError(401, "UNAUTHORIZED", "Invalid or missing authentication token");
  }
}

// Accepts Cookie JWT, Bearer JWT, or x-api-key — all three credential types.
// Sets request.user identically regardless of method so downstream handlers are transparent.
export async function authenticateAny(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const apiKeyHeader = request.headers["x-api-key"];
  const cookieToken = (request as FastifyRequest & { cookies?: { accessToken?: string } }).cookies?.accessToken;
  const authorizationHeader = request.headers.authorization;
  const bearerToken =
    typeof authorizationHeader === "string" && authorizationHeader.toLowerCase().startsWith("bearer ")
      ? authorizationHeader.slice(7).trim()
      : null;

  const jwtToken = cookieToken || bearerToken;

  if (jwtToken) {
    try {
      request.user = (await request.server.jwt.verify(jwtToken)) as FastifyRequest["user"];
      return;
    } catch {
      throw new AppError(401, "UNAUTHORIZED", "Invalid or missing authentication token");
    }
  }

  if (apiKeyHeader && typeof apiKeyHeader === "string") {
    const keyHash = createHash("sha256").update(apiKeyHeader).digest("hex");
    const key = await prisma.aPIKey.findUnique({
      where: { keyHash },
      include: { user: true },
    });

    if (!key || !key.isActive) {
      throw new AppError(401, "INVALID_API_KEY", "Invalid API key");
    }

    request.user = {
      sub: key.userId,
      email: key.user.email,
      role: key.user.role,
      type: "api_key",
      apiKeyId: key.id,
    };

    // fire-and-forget lastUsedAt update
    void prisma.aPIKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
    return;
  }

  throw new AppError(401, "UNAUTHORIZED", "Invalid or missing authentication token");
}

export function authorize(roles: Array<"USER" | "ADMIN">) {
  return async function roleGuard(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const user = request.user as { role?: "USER" | "ADMIN" } | undefined;

    if (!user?.role || !roles.includes(user.role)) {
      throw new AppError(403, "FORBIDDEN", "Insufficient permissions");
    }
  };
}
