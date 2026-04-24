import Fastify from "fastify";
import sensible from "@fastify/sensible";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import websocket from "@fastify/websocket";
import multipart from "@fastify/multipart";
import rawBody from "fastify-raw-body";
import { env } from "./config/env.js";
import { registerSecurityPlugins } from "./common/plugins/security.js";
import { errorHandler } from "./common/middleware/error-handler.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { contactRoutes } from "./modules/contact/contact.routes.js";
import { planRoutes } from "./modules/plan/plan.routes.js";
import { conversationRoutes } from "./modules/conversation/conversation.routes.js";
import { integrationRoutes } from "./modules/integration/integration.routes.js";
import { knowledgeRoutes } from "./modules/knowledge/knowledge.routes.js";
import { workflowRoutes } from "./modules/workflow/workflow.routes.js";
import { analyticsRoutes } from "./modules/analytics/analytics.routes.js";
import { subscriptionRoutes } from "./modules/subscription/subscription.routes.js";
import { userRoutes } from "./modules/user/user.routes.js";
import { voiceRoutes } from "./modules/voice/voice.routes.js";
import { developerRoutes } from "./modules/developer/developer.routes.js";
import { webhookRoutes } from "./modules/webhook/webhook.routes.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { registerWebSocketGateway } from "./infra/ws/ws.gateway.js";
import { ConversationRepository } from "./modules/conversation/conversation.repository.js";
import { AiOrchestratorService } from "./services/ai/ai-orchestrator.service.js";
import { RagService } from "./services/rag/rag.service.js";

export async function buildApp() {
  const app = Fastify({
    logger:
      env.NODE_ENV === "production"
        ? { level: "info" }
        : {
            level: "debug",
            transport: {
              target: "pino-pretty",
              options: {
                translateTime: "SYS:standard",
                colorize: true,
              },
            },
          },
  });

  app.setErrorHandler(errorHandler);

  await app.register(sensible);
  await app.register(cookie);
  await app.register(websocket);
  await app.register(multipart, {
    limits: {
      fileSize: 25 * 1024 * 1024,
      files: 1,
    },
  });
  await app.register(rawBody, {
    field: "rawBody",
    global: false,
    encoding: "utf8",
    runFirst: true,
  });

  await app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET,
  });

  await app.register(jwt, {
    namespace: "refreshJwt",
    secret: env.JWT_REFRESH_SECRET,
  });

  await registerSecurityPlugins(app);

  app.get("/", async () => ({
    status: "ok",
    service: "voxai-backend",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      keepAlive: "/keep-alive",
      auth: "/api/auth",
      plans: "/api/plans",
      conversations: "/api/conversations",
      contact: "/api/contact",
      workflows: "/api/workflows",
      analytics: "/api/analytics/dashboard",
      users: "/api/users/me",
      voice: "/api/voice/settings",
      developer: "/api/developer/keys",
      admin: "/api/admin/users/search",
      resendWebhook: "/api/webhooks/resend",
    },
    timestamp: new Date().toISOString(),
  }));

  app.get("/health", {
    config: {
      rateLimit: false,
    },
  }, async () => ({
    status: "ok",
    service: "voxai-backend",
    timestamp: new Date().toISOString(),
  }));

  app.get("/keep-alive", {
    config: {
      rateLimit: false,
    },
  }, async (_request, reply) => {
    reply.code(200).type("text/plain; charset=utf-8").send("OK");
  });

  app.get("/robots.txt", async (_request, reply) => {
    const appOrigin = env.APP_ORIGIN.replace(/\/+$/, "");
    reply.type("text/plain; charset=utf-8").send([
      "User-agent: *",
      "Allow: /",
      "Disallow: /api/",
      `Host: ${appOrigin}`,
      `Sitemap: ${appOrigin}/sitemap.xml`,
      "",
    ].join("\n"));
  });

  app.get("/sitemap.xml", async (_request, reply) => {
    const appOrigin = env.APP_ORIGIN.replace(/\/+$/, "");
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      "  <url>",
      `    <loc>${appOrigin}/</loc>`,
      "    <changefreq>weekly</changefreq>",
      "    <priority>1.0</priority>",
      "  </url>",
      "  <url>",
      `    <loc>${appOrigin}/health</loc>`,
      "    <changefreq>daily</changefreq>",
      "    <priority>0.8</priority>",
      "  </url>",
      "</urlset>",
      "",
    ].join("\n");

    reply.type("application/xml; charset=utf-8").send(xml);
  });

  await app.register(authRoutes);
  await app.register(contactRoutes);
  await app.register(planRoutes);
  await app.register(conversationRoutes);
  await app.register(integrationRoutes);
  await app.register(knowledgeRoutes);
  await app.register(workflowRoutes);
  await app.register(analyticsRoutes);
  await app.register(subscriptionRoutes);
  await app.register(userRoutes);
  await app.register(voiceRoutes);
  await app.register(developerRoutes);
  await app.register(adminRoutes);
  await app.register(webhookRoutes);

  registerWebSocketGateway(app, new AiOrchestratorService(new RagService()), new ConversationRepository());

  return app;
}
