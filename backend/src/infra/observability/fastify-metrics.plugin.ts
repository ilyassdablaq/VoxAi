import type { FastifyInstance } from "fastify";
import {
  httpRequestDuration,
  httpRequestsTotal,
  renderPrometheus,
} from "./metrics.js";

declare module "fastify" {
  interface FastifyRequest {
    _metricsStart?: bigint;
  }
}

export async function registerMetricsPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("onRequest", async (request) => {
    request._metricsStart = process.hrtime.bigint();
  });

  fastify.addHook("onResponse", async (request, reply) => {
    if (!request._metricsStart) return;
    const elapsedMs = Number(process.hrtime.bigint() - request._metricsStart) / 1_000_000;
    const route = request.routeOptions?.url ?? request.url ?? "unknown";
    const labels = {
      method: request.method,
      route,
      status: String(reply.statusCode),
    };
    httpRequestDuration.observe(elapsedMs, labels);
    httpRequestsTotal.inc(1, labels);
  });

  fastify.get("/metrics", { config: { rateLimit: false } }, async (_req, reply) => {
    reply.type("text/plain; version=0.0.4").send(renderPrometheus());
  });
}
