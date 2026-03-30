import { AppError } from "../../common/errors/app-error.js";
import { logger } from "../../config/logger.js";
import { prisma } from "../../infra/database/prisma.js";
import {
  STRIPE_CONFIG,
  getStripeCheckoutPaymentMethods,
  getStripeClient,
  getStripePaymentMethodDisplay,
} from "../../config/stripe.js";
import { getPlanKeyFromStripePrice, getStripePriceForPlan, normalizePlanKeyForCheckout } from "../../config/plan-stripe-mapping.js";

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

    const normalizedPlanKey = normalizePlanKeyForCheckout(planKey);

    // Resolve by exact key first, then by normalized key, then by plan type fallback.
    const plan = await this.resolveCheckoutPlan(normalizedPlanKey, planKey);

    if (!plan) {
      throw new AppError(404, 'PLAN_NOT_FOUND', 'Requested plan not found');
    }

    const stripePriceId =
      plan.stripePriceId ||
      getStripePriceForPlan(plan.key) ||
      getStripePriceForPlan(normalizedPlanKey);

    if (!stripePriceId) {
      throw new AppError(400, 'PLAN_NOT_AVAILABLE', 'This plan is not available for purchase');
    }

    try {
      const successUrl = redirectUrls?.successUrl ?? STRIPE_CONFIG.successUrl;
      const cancelUrl = redirectUrls?.cancelUrl ?? STRIPE_CONFIG.cancelUrl;
      const configuredPaymentMethods = getStripeCheckoutPaymentMethods();

      const session = await this.createCheckoutSessionWithPaymentMethods(
        configuredPaymentMethods,
        userId,
        plan.id,
        plan.key,
        stripePriceId,
        successUrl,
        cancelUrl,
      );

      logger.info({ userId, requestedPlanKey: planKey, resolvedPlanKey: plan.key, sessionId: session.id }, 'Stripe checkout session created');
      return { sessionId: session.id, url: session.url };
    } catch (error) {
      logger.error({ error, userId, requestedPlanKey: planKey, resolvedPlanKey: plan.key }, 'Stripe session creation failed');
      throw new AppError(500, 'CHECKOUT_FAILED', 'Failed to create checkout session');
    }
  }

  private async resolveCheckoutPlan(normalizedPlanKey: string, requestedPlanKey: string) {
    const candidateKeys = Array.from(new Set([requestedPlanKey, normalizedPlanKey]));

    const directPlan = await prisma.plan.findFirst({
      where: { key: { in: candidateKeys } },
      select: { id: true, key: true, name: true, stripeProductId: true, stripePriceId: true },
    });

    if (directPlan) {
      return directPlan;
    }

    const fallbackType = this.getPlanTypeForKey(normalizedPlanKey);
    if (!fallbackType) {
      return null;
    }

    return prisma.plan.findFirst({
      where: { type: fallbackType, isActive: true },
      orderBy: [{ interval: 'asc' }, { priceCents: 'asc' }],
      select: { id: true, name: true, key: true, stripeProductId: true, stripePriceId: true },
    });
  }

  private getPlanTypeForKey(planKey: string): 'PRO' | 'ENTERPRISE' | null {
    if (planKey.startsWith('pro')) {
      return 'PRO';
    }

    if (planKey.startsWith('enterprise')) {
      return 'ENTERPRISE';
    }

    return null;
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhookEvent(event: any) {
    logger.debug({ eventType: event.type, eventId: event.id }, 'Stripe webhook received');

    switch (event.type) {
      case 'checkout.session.completed':
        return this.handleCheckoutSessionCompleted(event.data.object);

      case 'checkout.session.async_payment_failed':
        return this.handleCheckoutPaymentFailed(event.data.object);

      case 'customer.subscription.updated':
        return this.handleSubscriptionUpdated(event.data.object);

      case 'invoice.payment_failed':
        return this.handleInvoicePaymentFailed(event.data.object);

      case 'invoice.payment_succeeded':
        return this.handleInvoicePaymentSucceeded(event.data.object);

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
    const metadata = session.metadata ?? {};
    let userId = metadata.userId as string | undefined;
    let planId = metadata.planId as string | undefined;
    let planKey = metadata.planKey as string | undefined;
    const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : null;

    if (!userId || !planId) {
      const resolvedCheckout = await this.resolveCheckoutSessionWithoutMetadata(session);
      if (!resolvedCheckout) {
        logger.warn({ sessionId: session.id }, 'Checkout session metadata missing userId/planId and fallback resolution failed');
        return null;
      }

      userId = resolvedCheckout.userId;
      planId = resolvedCheckout.planId;
      planKey = resolvedCheckout.planKey;

      logger.info(
        { sessionId: session.id, userId, planKey, source: 'payment-link-fallback' },
        'Resolved checkout session without metadata'
      );
    }

    try {
      if (stripeSubscriptionId) {
        const existing = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId },
          include: { plan: true },
        });

        if (existing) {
          const updatedExisting = await prisma.subscription.update({
            where: { id: existing.id },
            data: {
              status: 'ACTIVE',
              endsAt: null,
              stripeCustomerId: typeof session.customer === 'string' ? session.customer : existing.stripeCustomerId,
            },
            include: { plan: true },
          });

          logger.info(
            { userId, planKey, stripeSubscriptionId },
            'Subscription already exists for Stripe checkout, status refreshed'
          );

          return updatedExisting;
        }
      }

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
          stripeSubscriptionId,
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

  private async resolveCheckoutSessionWithoutMetadata(
    session: any,
  ): Promise<{ userId: string; planId: string; planKey: string } | null> {
    const email =
      (session?.customer_details?.email as string | undefined) ??
      (session?.customer_email as string | undefined) ??
      null;

    if (!email) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (!user) {
      logger.warn({ sessionId: session?.id, email }, 'Stripe checkout email does not match any user');
      return null;
    }

    const stripePriceId = await this.extractStripePriceIdFromSession(session);
    if (!stripePriceId) {
      logger.warn({ sessionId: session?.id, email }, 'Unable to resolve Stripe price ID from checkout session');
      return null;
    }

    const mappedPlanKey = getPlanKeyFromStripePrice(stripePriceId);
    const candidatePlanKeys = mappedPlanKey
      ? Array.from(new Set([mappedPlanKey, normalizePlanKeyForCheckout(mappedPlanKey)]))
      : [];

    let plan = await prisma.plan.findFirst({
      where: {
        isActive: true,
        OR: [
          { stripePriceId },
          ...(candidatePlanKeys.length > 0 ? [{ key: { in: candidatePlanKeys } }] : []),
        ],
      },
      select: { id: true, key: true },
    });

    if (!plan && mappedPlanKey) {
      const normalizedPlanKey = normalizePlanKeyForCheckout(mappedPlanKey);
      plan = await this.resolveCheckoutPlan(normalizedPlanKey, mappedPlanKey);
    }

    if (!plan) {
      logger.warn(
        { sessionId: session?.id, email, stripePriceId, mappedPlanKey },
        'Could not resolve plan from Stripe checkout session'
      );
      return null;
    }

    return {
      userId: user.id,
      planId: plan.id,
      planKey: plan.key,
    };
  }

  private async extractStripePriceIdFromSession(session: any): Promise<string | null> {
    const lineItems = session?.line_items?.data;
    if (Array.isArray(lineItems) && lineItems.length > 0) {
      const priceId = lineItems[0]?.price?.id;
      if (typeof priceId === 'string' && priceId.length > 0) {
        return priceId;
      }
    }

    if (!this.stripe || !session?.id) {
      return null;
    }

    try {
      const fetchedLineItems = await this.stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
      const fetchedPriceId = fetchedLineItems?.data?.[0]?.price?.id;
      return typeof fetchedPriceId === 'string' && fetchedPriceId.length > 0 ? fetchedPriceId : null;
    } catch (error) {
      logger.warn({ err: error, sessionId: session?.id }, 'Failed to fetch Stripe checkout line items');
      return null;
    }
  }

  /**
   * Handle subscription update
   */
  private async handleSubscriptionUpdated(subscription: any) {
    const planKey = getPlanKeyFromStripePrice(subscription.items.data[0]?.price.id);
    const status = this.mapStripeSubscriptionStatus(subscription.status);

    try {
      const updated = await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          status,
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
   * Handle checkout async payment failure
   */
  private async handleCheckoutPaymentFailed(session: any) {
    const userId = session?.metadata?.userId as string | undefined;

    if (!userId) {
      logger.warn({ sessionId: session?.id }, 'Checkout failed event missing user metadata');
      return null;
    }

    const updated = await prisma.subscription.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'INACTIVE', endsAt: new Date() },
    });

    logger.info({ userId, sessionId: session?.id }, 'Checkout async payment failed, subscription marked inactive');
    return updated;
  }

  /**
   * Handle invoice payment failure
   */
  private async handleInvoicePaymentFailed(invoice: any) {
    const stripeSubscriptionId = typeof invoice?.subscription === 'string' ? invoice.subscription : null;
    if (!stripeSubscriptionId) {
      return null;
    }

    const updated = await prisma.subscription.updateMany({
      where: { stripeSubscriptionId },
      data: { status: 'INACTIVE' },
    });

    logger.info({ stripeSubscriptionId }, 'Invoice payment failed, subscription marked inactive');
    return updated;
  }

  /**
   * Handle invoice payment success
   */
  private async handleInvoicePaymentSucceeded(invoice: any) {
    const stripeSubscriptionId = typeof invoice?.subscription === 'string' ? invoice.subscription : null;
    if (!stripeSubscriptionId) {
      return null;
    }

    const updated = await prisma.subscription.updateMany({
      where: { stripeSubscriptionId },
      data: { status: 'ACTIVE', endsAt: null },
    });

    logger.info({ stripeSubscriptionId }, 'Invoice payment succeeded, subscription marked active');
    return updated;
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

  getCheckoutCapabilities() {
    return {
      paymentMethods: getStripePaymentMethodDisplay(),
    };
  }

  async cancelSubscriptionById(stripeSubscriptionId: string) {
    if (!this.stripe) {
      throw new AppError(503, 'STRIPE_NOT_CONFIGURED', 'Payment processing is temporarily unavailable');
    }

    try {
      const canceled = await this.stripe.subscriptions.cancel(stripeSubscriptionId);
      logger.info({ stripeSubscriptionId }, 'Stripe subscription canceled');
      return canceled;
    } catch (error) {
      logger.error({ error, stripeSubscriptionId }, 'Failed to cancel Stripe subscription');
      throw new AppError(502, 'STRIPE_CANCELLATION_FAILED', 'Unable to cancel Stripe subscription');
    }
  }

  private mapStripeSubscriptionStatus(status: string): 'ACTIVE' | 'INACTIVE' | 'CANCELED' | 'EXPIRED' {
    switch (status) {
      case 'active':
      case 'trialing':
        return 'ACTIVE';
      case 'canceled':
        return 'CANCELED';
      case 'incomplete_expired':
        return 'EXPIRED';
      default:
        return 'INACTIVE';
    }
  }

  private async createCheckoutSessionWithPaymentMethods(
    configuredPaymentMethods: Array<'card' | 'paypal' | 'sepa_debit'>,
    userId: string,
    planId: string,
    planKey: string,
    stripePriceId: string,
    successUrl: string,
    cancelUrl: string,
  ) {
    try {
      return await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: configuredPaymentMethods,
        payment_method_collection: 'always',
        line_items: [
          {
            price: stripePriceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId,
          planId,
          planKey,
        },
      });
    } catch (error) {
      if (configuredPaymentMethods.length > 1) {
        logger.warn(
          { err: error, paymentMethods: configuredPaymentMethods },
          'Configured Stripe payment methods rejected, retrying with card only'
        );

        return this.stripe.checkout.sessions.create({
          mode: 'subscription',
          payment_method_types: ['card'],
          payment_method_collection: 'always',
          line_items: [
            {
              price: stripePriceId,
              quantity: 1,
            },
          ],
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            userId,
            planId,
            planKey,
          },
        });
      }

      throw error;
    }
  }
}

export const stripeService = new StripeService();
