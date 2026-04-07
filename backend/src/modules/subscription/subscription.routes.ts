import { FastifyInstance } from "fastify";
import { authenticate } from "../../common/middleware/auth-middleware.js";
import { SubscriptionRepository } from "./subscription.repository.js";
import { SubscriptionService } from "./subscription.service.js";
import { stripeService } from "../../services/stripe/stripe.service.js";
import { AppError } from "../../common/errors/app-error.js";
import { PlanService } from "../plan/plan.service.js";
import { PlanRepository } from "../plan/plan.repository.js";
import { env } from "../../config/env.js";
import { normalizePlanKeyForCheckout } from "../../config/plan-stripe-mapping.js";
import { idempotencyService } from "../../common/services/idempotency.service.js";

function resolveCheckoutBaseOrigin(originHeader: string | undefined): string {
  if (!originHeader) {
    return env.APP_ORIGIN;
  }

  const isLocalhost = /^https?:\/\/localhost(:\d+)?$/i.test(originHeader);
  if (isLocalhost) {
    return originHeader;
  }

  return env.APP_ORIGIN;
}

export async function subscriptionRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new SubscriptionService(new SubscriptionRepository());
  const planService = new PlanService(new PlanRepository());

  // Get current user subscription with plan details
  fastify.get(
    "/api/subscriptions/current",
    { preHandler: [authenticate] },
    async (request) => {
      const user = request.user as { sub: string };
      return service.getCurrentSubscription(user.sub);
    }
  );

  // Get all available plans
  fastify.get(
    "/api/subscriptions/available",
    async () => {
      return service.getAvailablePlans();
    }
  );

  // Get checkout payment method capabilities for pricing/checkout UX
  fastify.get(
    "/api/subscriptions/payment-methods",
    async () => {
      return stripeService.getCheckoutCapabilities();
    }
  );

  // Start Stripe checkout for plan upgrade
  fastify.post(
    "/api/subscriptions/upgrade",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as { sub: string };
      const { planKey } = request.body as { planKey?: string };
      const originHeader = request.headers.origin;
      const baseOrigin = resolveCheckoutBaseOrigin(originHeader);

      if (!planKey) {
        throw new AppError(400, 'INVALID_INPUT', 'planKey is required');
      }

      const normalizedPlanKey = normalizePlanKeyForCheckout(planKey);

      if (normalizedPlanKey === 'free') {
        const idempotencyKey = idempotencyService.resolveKey(
          typeof request.headers["idempotency-key"] === "string" ? request.headers["idempotency-key"] : undefined,
          ["subscription", "upgrade", user.sub, normalizedPlanKey],
        );

        const result = await idempotencyService.execute({
          scope: `subscription:${user.sub}:upgrade`,
          key: idempotencyKey,
          run: async () => {
            await planService.changePlan(user.sub, 'free');
            return {
              statusCode: 200,
              body: {
                sessionId: 'free-plan',
                url: null,
                mode: 'direct',
              },
            };
          },
        });

        return reply.status(result.statusCode).send(result.body);
      }

      const idempotencyKey = idempotencyService.resolveKey(
        typeof request.headers["idempotency-key"] === "string" ? request.headers["idempotency-key"] : undefined,
        ["subscription", "upgrade", user.sub, normalizedPlanKey],
      );

      const result = await idempotencyService.execute({
        scope: `subscription:${user.sub}:upgrade`,
        key: idempotencyKey,
        run: async () => {
          const { sessionId, url } = await stripeService.createCheckoutSession(user.sub, normalizedPlanKey, {
            successUrl: `${baseOrigin}/dashboard?payment=success`,
            cancelUrl: `${baseOrigin}/dashboard/subscriptions?payment=cancelled`,
          });

          return {
            statusCode: 200,
            body: { sessionId, url, mode: 'checkout' },
          };
        },
      });

      return reply.status(result.statusCode).send(result.body);
    }
  );

  // Cancel active paid subscription and switch back to free plan
  fastify.post(
    "/api/subscriptions/cancel",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as { sub: string };

      const idempotencyKey = idempotencyService.resolveKey(
        typeof request.headers["idempotency-key"] === "string" ? request.headers["idempotency-key"] : undefined,
        ["subscription", "cancel", user.sub],
      );

      const result = await idempotencyService.execute({
        scope: `subscription:${user.sub}:cancel`,
        key: idempotencyKey,
        run: async () => {
          const body = await service.cancelAtPeriodEnd(user.sub);
          return {
            statusCode: 200,
            body,
          };
        },
      });

      return reply.status(result.statusCode).send(result.body);
    }
  );

  // Stripe webhook handler (raw body required for signature verification)
  fastify.post(
    "/api/webhooks/stripe",
    { preHandler: [], bodyLimit: 1048576 },
    async (request, reply) => {
      const signature = request.headers['stripe-signature'] as string;

      if (!signature) {
        throw new AppError(400, 'MISSING_SIGNATURE', 'Missing Stripe signature header');
      }

      // Get raw body as string for verification
      const rawBody = request.body as unknown;
      const bodyString = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);

      const isValid = stripeService.verifyWebhookSignature(bodyString, signature);
      if (!isValid) {
        throw new AppError(401, 'INVALID_SIGNATURE', 'Invalid Stripe signature');
      }

      // Parse and handle event
      const event = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
      const eventId = typeof event?.id === "string" ? event.id : `stripe:${bodyString.slice(0, 128)}`;

      const result = await idempotencyService.execute({
        scope: "webhook:stripe",
        key: eventId,
        run: async () => {
          await stripeService.handleWebhookEvent(event);
          return {
            statusCode: 200,
            body: { received: true },
          };
        },
      });

      return reply.status(result.statusCode).send(result.body);
    }
  );
}

