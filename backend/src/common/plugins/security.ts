import { FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { env } from "../../config/env.js";
import { redis } from "../../infra/cache/redis.js";
import { prisma } from "../../infra/database/prisma.js";
import { rateLimitService } from "../services/plan-rate-limit.service.js";
import { AppError } from "../errors/app-error.js";
import { logger } from "../../config/logger.js";
import { PlanCheckService } from "../services/plan-check.service.js";

// Allowlist für externe Einbindung: Passe Domains nach Bedarf an
const ALLOWED_ORIGINS = [
  /^https:\/\/([\w-]+\.)*vercel\.app$/,
  /^https:\/\/[a-z0-9-]+\.deine-domain\.tld$/,
  /^https:\/\/[a-z0-9-]+\.partnerseite\.tld$/,
];

function isAllowedOrigin(origin: string): boolean {
  if (origin === env.APP_ORIGIN) {
    return true;
  }
  for (const pattern of ALLOWED_ORIGINS) {
    if (pattern.test(origin)) return true;
  }
  if (env.NODE_ENV !== "production") {
    try {
      const parsed = new URL(origin);
      return ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
    } catch {
      return false;
    }
  }
  return false;
}

export async function registerSecurityPlugins(fastify: FastifyInstance): Promise<void> {
  const planCheckService = new PlanCheckService();

  await fastify.register(helmet, {
    global: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    xFrameOptions: { action: "deny" },
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  });

  await fastify.register(cors, {
    origin: (origin, callback) => {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin not allowed"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Global rate limit (catches everything)
  await fastify.register(rateLimit, {
    max: 1000,
    timeWindow: "1 minute",
    skipOnError: true,
    addHeadersOnExceeding: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
    },
    keyGenerator(request) {
      const user = request.user as { sub?: string; type?: string; apiKeyId?: string } | undefined;
      const principal = user?.type === "api_key" && user.apiKeyId ? `api-key:${user.apiKeyId}` : user?.sub ? `user:${user.sub}` : `ip:${request.ip}`;
      return `${principal}:${request.routeOptions.url}`;
    },
  });

  // Plan-based rate limiting for authenticated requests
  fastify.addHook("preHandler", async (request, _reply) => {
    const user = request.user as { sub?: string; type?: string; apiKeyId?: string } | undefined;

    // Skip rate limit check for public endpoints
    if (!user || !user.sub) {
      return;
    }

    try {
      // Determine plan type
      let planType = "FREE";
      if (user.type === "api_key") {
        // Look up API key plan via user
        const apiKey = await prisma.aPIKey.findUnique({
          where: { id: user.apiKeyId },
          include: { user: { include: { subscriptions: { include: { plan: true } } } } },
        });

        if (apiKey?.user?.subscriptions?.[0]?.plan) {
          planType = apiKey.user.subscriptions[0].plan.type;
        }
      } else {
        const effectivePlan = await planCheckService.getEffectivePlanAccess(user.sub);
        planType = effectivePlan.type;
      }

      const principal = user.type === "api_key" ? `api-key:${user.apiKeyId}` : `user:${user.sub}`;

      // Check minute-level limit strict for FREE
      if (planType === "FREE") {
        const allowed = await rateLimitService.checkRequestLimit(principal, planType as any, "minute");
        if (!allowed) {
          logger.warn({ principal, planType }, "Rate limit exceeded (minute)");
          throw new AppError(429, "RATE_LIMIT_EXCEEDED", "Rate limit exceeded. Please try again later.");
        }
      }

      // Store plan in request context for later use
      (request as any).userPlan = planType;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error({ error }, "Error checking plan-based rate limit");
      // Don't fail auth on rate limit check error; let it pass
    }
  });
}
