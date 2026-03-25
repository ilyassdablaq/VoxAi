import { AppError } from "../../common/errors/app-error.js";
import { logger } from "../../config/logger.js";
import { prisma } from "../../infra/database/prisma.js";
import { STRIPE_CONFIG, getStripeClient } from "../../config/stripe.js";
import { getPlanKeyFromStripePrice } from "../../config/plan-stripe-mapping.js";

export class StripeService {
  private stripe: any;

  constructor() {
    try {
      this.stripe = getStripeClient();
    } catch (error) {
      logger.warn({ err: error }, 'Stripe not initialized - payment features will be disabled');
      this.stripe = null;
    }
  }

  /**
   * Create Stripe checkout session for plan upgrade
   */
  async createCheckoutSession(
    userId: string,
    planKey: string,
    redirectUrls?: { successUrl?: string; cancelUrl?: string },
  ) {
    if (!this.stripe) {
      throw new AppError(503, 'STRIPE_NOT_CONFIGURED', 'Payment processing is temporarily unavailable');
    }

    // Get plan from database to verify it exists
    const plan = await prisma.plan.findUnique({
      where: { key: planKey },
      select: { id: true, name: true, stripeProductId: true, stripePriceId: true },
    });

    if (!plan) {
      throw new AppError(404, 'PLAN_NOT_FOUND', 'Requested plan not found');
    }

    if (!plan.stripePriceId) {
      throw new AppError(400, 'PLAN_NOT_AVAILABLE', 'This plan is not available for purchase');
    }

    try {
      const successUrl = redirectUrls?.successUrl ?? STRIPE_CONFIG.successUrl;
      const cancelUrl = redirectUrls?.cancelUrl ?? STRIPE_CONFIG.cancelUrl;

      const session = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: plan.stripePriceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId,
          planId: plan.id,
          planKey,
        },
      });

      logger.info({ userId, planKey, sessionId: session.id }, 'Stripe checkout session created');
      return { sessionId: session.id, url: session.url };
    } catch (error) {
      logger.error({ error, userId, planKey }, 'Stripe session creation failed');
      throw new AppError(500, 'CHECKOUT_FAILED', 'Failed to create checkout session');
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhookEvent(event: any) {
    logger.debug({ eventType: event.type, eventId: event.id }, 'Stripe webhook received');

    switch (event.type) {
      case 'checkout.session.completed':
        return this.handleCheckoutSessionCompleted(event.data.object);

      case 'customer.subscription.updated':
        return this.handleSubscriptionUpdated(event.data.object);

      case 'customer.subscription.deleted':
        return this.handleSubscriptionDeleted(event.data.object);

      default:
        logger.debug({ eventType: event.type }, 'Unhandled webhook event type');
        return null;
    }
  }

  /**
   * Handle successful checkout session
   */
  private async handleCheckoutSessionCompleted(session: any) {
    const { userId, planId, planKey } = session.metadata;

    try {
      // Get all current active subscriptions and mark them as inactive
      await prisma.subscription.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: { status: 'INACTIVE', endsAt: new Date() },
      });

      // Create new subscription with Stripe info
      const subscription = await prisma.subscription.create({
        data: {
          userId,
          planId,
          status: 'ACTIVE',
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          startsAt: new Date(),
        },
        include: { plan: true },
      });

      logger.info(
        { userId, planKey, stripeSubscriptionId: session.subscription },
        'Subscription activated from Stripe checkout'
      );

      return subscription;
    } catch (error) {
      logger.error({ error, userId, planKey }, 'Failed to activate subscription from Stripe checkout');
      throw error;
    }
  }

  /**
   * Handle subscription update
   */
  private async handleSubscriptionUpdated(subscription: any) {
    const planKey = getPlanKeyFromStripePrice(subscription.items.data[0]?.price.id);

    try {
      const updated = await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          status: subscription.status === 'active' ? 'ACTIVE' : 'INACTIVE',
          endsAt: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000)
            : null,
        },
      });

      logger.info(
        { stripeSubscriptionId: subscription.id, planKey },
        'Subscription updated from Stripe webhook'
      );

      return updated;
    } catch (error) {
      logger.error({ error, stripeSubscriptionId: subscription.id }, 'Failed to update subscription');
      throw error;
    }
  }

  /**
   * Handle subscription cancellation
   */
  private async handleSubscriptionDeleted(subscription: any) {
    try {
      const updated = await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { status: 'CANCELED', endsAt: new Date() },
      });

      logger.info({ stripeSubscriptionId: subscription.id }, 'Subscription canceled from Stripe webhook');
      return updated;
    } catch (error) {
      logger.error({ error, stripeSubscriptionId: subscription.id }, 'Failed to cancel subscription');
      throw error;
    }
  }

  /**
   * Verify Stripe webhook signature
   */
  verifyWebhookSignature(body: string, signature: string): boolean {
    if (!this.stripe) return false;

    try {
      this.stripe.webhooks.constructEvent(body, signature, STRIPE_CONFIG.webhookSecret);
      return true;
    } catch (error) {
      logger.warn({ error }, 'Webhook signature verification failed');
      return false;
    }
  }
}

export const stripeService = new StripeService();
