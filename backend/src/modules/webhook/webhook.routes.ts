import { FastifyInstance } from "fastify";
import { AppError } from "../../common/errors/app-error.js";
import { resendWebhookService } from "../../services/email/resend-webhook.service.js";
import { env } from "../../config/env.js";
import { idempotencyService } from "../../common/services/idempotency.service.js";

export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    "/api/webhooks/resend",
    {
      config: {
        rawBody: true,
      },
      bodyLimit: 1048576,
    },
    async (request, reply) => {
      if (!env.RESEND_WEBHOOK_SECRET) {
        throw new AppError(503, "RESEND_WEBHOOK_NOT_CONFIGURED", "Resend webhook is not configured");
      }

      const svixId = request.headers["svix-id"];
      const svixTimestamp = request.headers["svix-timestamp"];
      const svixSignature = request.headers["svix-signature"];

      if (!svixId || !svixTimestamp || !svixSignature) {
        throw new AppError(400, "MISSING_SIGNATURE", "Missing webhook signature headers");
      }

      const rawBody = request.rawBody ?? JSON.stringify(request.body ?? {});
      const rawBodyString = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
      const isValid = resendWebhookService.verifySignature(rawBodyString, {
        svixId: String(svixId),
        svixTimestamp: String(svixTimestamp),
        svixSignature: String(svixSignature),
      });

      if (!isValid) {
        throw new AppError(401, "INVALID_SIGNATURE", "Invalid webhook signature");
      }

      const payload = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
      const result = await idempotencyService.execute({
        scope: "webhook:resend",
        key: String(svixId),
        run: async () => {
          await resendWebhookService.persistDeliveryStatus(payload);
          return {
            statusCode: 200,
            body: { received: true },
          };
        },
      });

      return reply.status(result.statusCode).send(result.body);
    },
  );
}
