/**
 * Map plan keys to Stripe Product/Price IDs
 * These should be created in Stripe dashboard or via Stripe API
 * Format: plan-key -> { productId: string, priceId: string }
 */
export const PLAN_STRIPE_MAP: Record<string, { productId: string; priceId: string }> = {
  'free': {
    productId: 'prod_free',
    priceId: 'price_free',
  },
  'pro-monthly': {
    productId: 'prod_pro',
    priceId: 'price_pro_monthly',
  },
  'pro-yearly': {
    productId: 'prod_pro',
    priceId: 'price_pro_yearly',
  },
  'enterprise-monthly': {
    productId: 'prod_enterprise',
    priceId: 'price_enterprise_monthly',
  },
  'enterprise-yearly': {
    productId: 'prod_enterprise',
    priceId: 'price_enterprise_yearly',
  },
};

/**
 * Helper: Get Stripe price for plan key
 */
export function getStripePriceForPlan(planKey: string): string | null {
  return PLAN_STRIPE_MAP[planKey]?.priceId || null;
}

/**
 * Helper: Get plan key from Stripe price ID
 */
export function getPlanKeyFromStripePrice(priceId: string): string | null {
  for (const [planKey, config] of Object.entries(PLAN_STRIPE_MAP)) {
    if (config.priceId === priceId) {
      return planKey;
    }
  }
  return null;
}
