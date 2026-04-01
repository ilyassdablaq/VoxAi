import { createHash } from "node:crypto";
import { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../infra/database/prisma.js";
import { AppError } from "../errors/app-error.js";

export async function authenticateApiKey(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const apiKey = request.headers["x-api-key"];

  if (!apiKey || typeof apiKey !== "string") {
    throw new AppError(401, "API_KEY_REQUIRED", "Missing API key");
  }

  const keyHash = createHash("sha256").update(apiKey).digest("hex");
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

  await prisma.aPIKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  });
}
