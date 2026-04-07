import { FastifyRequest } from "fastify";
import { env } from "../../config/env.js";
import { AppError } from "../errors/app-error.js";

function normalizeIp(value: string): string {
  return value.trim().toLowerCase();
}

const configuredIps = (env.ADMIN_IP_ALLOWLIST ?? "")
  .split(",")
  .map(normalizeIp)
  .filter(Boolean);

const allowlist = new Set(configuredIps);

export async function enforceAdminIpAllowlist(request: FastifyRequest): Promise<void> {
  if (allowlist.size === 0) {
    return;
  }

  const requestIp = normalizeIp(request.ip);
  if (!allowlist.has(requestIp)) {
    throw new AppError(403, "ADMIN_IP_NOT_ALLOWED", "Access denied from this IP address");
  }
}
