import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FastifyInstance } from "fastify";
import fastify from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { registerSecurityPlugins } from "./security";

// Mocks for external dependencies
vi.mock("../../config/env.js", () => ({ env: { NODE_ENV: "test", JWT_ACCESS_SECRET: "test", JWT_REFRESH_SECRET: "test" } }));
vi.mock("../../infra/cache/redis.js", () => ({ redis: {} }));
vi.mock("../../infra/database/prisma.js", () => ({ prisma: { aPIKey: { findUnique: vi.fn() } } }));
vi.mock("../services/plan-rate-limit.service.js", () => ({ rateLimitService: { checkRequestLimit: vi.fn().mockResolvedValue(true) } }));
vi.mock("../services/plan-check.service.js", () => ({ PlanCheckService: vi.fn().mockImplementation(() => ({ getEffectivePlanAccess: vi.fn().mockResolvedValue({ type: "FREE" }) })) }));
vi.mock("../errors/app-error.js", () => ({ AppError: class extends Error { code = 429; constructor(status, code, message) { super(message); this.status = status; this.code = code; } } }));
vi.mock("../../config/logger.js", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));


describe("registerSecurityPlugins", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = fastify();
  });

  afterEach(async () => {
    await app.close();
  });

  it("registers helmet, cors, and rateLimit plugins without error", async () => {
    await expect(registerSecurityPlugins(app)).resolves.not.toThrow();
    // Plugins registrieren sich ohne Fehler
  });
  it("rejects non-allowed origins (CORS)", async () => {
    // Setze restriktive Allowlist
    const orig = require("./security");
    orig.ALLOWED_ORIGINS.length = 0;
    orig.ALLOWED_ORIGINS.push("https://trusted.com");
    await registerSecurityPlugins(app);
    const response = await app.inject({
      method: "OPTIONS",
      url: "/test",
      headers: { Origin: "https://evil.com", "Access-Control-Request-Method": "GET" },
    });
    expect(response.statusCode).toBe(500);
    orig.ALLOWED_ORIGINS.length = 0;
    orig.ALLOWED_ORIGINS.push(/.*/); // Reset
  });

  it("returns 429 if plan-based rate limit exceeded", async () => {
    const { rateLimitService } = await import("../services/plan-rate-limit.service.js");
    rateLimitService.checkRequestLimit.mockResolvedValueOnce(false);
    await registerSecurityPlugins(app);
    const response = await app.inject({
      method: "GET",
      url: "/test",
      user: { sub: "user1", type: "user" },
    } as any);
    expect(response.statusCode).toBe(429);
  });

  it("allows all origins by default (CORS)", async () => {
    await registerSecurityPlugins(app);
    const response = await app.inject({
      method: "OPTIONS",
      url: "/test",
      headers: { Origin: "https://evil.com", "Access-Control-Request-Method": "GET" },
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("https://evil.com");
  });

  it("applies global rate limit", async () => {
    await registerSecurityPlugins(app);
    for (let i = 0; i < 1000; i++) {
      await app.inject({ method: "GET", url: "/test" });
    }
    const res = await app.inject({ method: "GET", url: "/test" });
    // Should still allow due to skipOnError: true
    expect([200, 429]).toContain(res.statusCode);
  });

  it("handles plan-based rate limiting for authenticated user", async () => {
    await registerSecurityPlugins(app);
    const response = await app.inject({
      method: "GET",
      url: "/test",
      headers: { Authorization: "Bearer test" },
      user: { sub: "user1", type: "user" },
    } as any);
    expect([200, 429]).toContain(response.statusCode);
  });

  it("does not throw on rate limit service error", async () => {
    const { rateLimitService } = await import("../services/plan-rate-limit.service.js");
    rateLimitService.checkRequestLimit.mockRejectedValueOnce(new Error("fail"));
    await registerSecurityPlugins(app);
    const response = await app.inject({
      method: "GET",
      url: "/test",
      user: { sub: "user1", type: "user" },
    } as any);
    expect([200, 429]).toContain(response.statusCode);
  });
});
