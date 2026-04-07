import Fastify from "fastify";
import sensible from "@fastify/sensible";
import jwt from "@fastify/jwt";
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

  await registerSecurityPlugins(app);

  app.get("/", async () => ({
    status: "ok",
    service: "voxai-backend",
    version: "1.0.0",
    endpoints: {
      health: "/health",
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

  app.get("/health", async () => ({
    status: "ok",
    service: "voxai-backend",
    timestamp: new Date().toISOString(),
  }));

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
