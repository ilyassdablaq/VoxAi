import { FastifyInstance } from "fastify";
import { authenticate } from "../../common/middleware/auth-middleware.js";
import { SubscriptionRepository } from "./subscription.repository.js";
import { SubscriptionService } from "./subscription.service.js";
import { stripeService } from "../../services/stripe/stripe.service.js";
import { AppError } from "../../common/errors/app-error.js";
import { PlanService } from "../plan/plan.service.js";
import { PlanRepository } from "../plan/plan.repository.js";
import { env } from "../../config/env.js";

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
    async (request) => {
      return service.getAvailablePlans();
    }
  );

  // Start Stripe checkout for plan upgrade
  fastify.post(
    "/api/subscriptions/upgrade",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as { sub: string };
      const { planKey } = request.body as { planKey?: string };

      if (!planKey) {
        throw new AppError(400, 'INVALID_INPUT', 'planKey is required');
      }

      try {
        const originHeader = request.headers.origin;
        const baseOrigin = resolveCheckoutBaseOrigin(originHeader);
        const { sessionId, url } = await stripeService.createCheckoutSession(user.sub, planKey, {
          successUrl: `${baseOrigin}/stripe-success`,
          cancelUrl: `${baseOrigin}/stripe-cancel`,
        });
        return reply.status(200).send({ sessionId, url });
      } catch (error) {
        if (
          env.NODE_ENV !== "production" &&
          error instanceof AppError &&
          error.code === "STRIPE_NOT_CONFIGURED"
        ) {
          await planService.changePlan(user.sub, planKey);
          const successUrl = `${env.APP_ORIGIN}/stripe-success?mode=dev-upgrade`;
          return reply.status(200).send({ sessionId: "dev-upgrade", url: successUrl });
        }

        throw error;
      }
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
      await stripeService.handleWebhookEvent(event);

      return reply.status(200).send({ received: true });
    }
  );
}

