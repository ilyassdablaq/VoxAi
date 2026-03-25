import { env } from "./env.js";
import Stripe from "stripe";

/**
 * Stripe SDK - initialize from environment variable
 * Requires STRIPE_SECRET_KEY in .env
 */
export const getStripeClient = () => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }

  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
  });
};

export const STRIPE_CONFIG = {
  webhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
  successUrl: env.STRIPE_SUCCESS_URL || `${env.APP_ORIGIN}/stripe-success`,
  cancelUrl: env.STRIPE_CANCEL_URL || `${env.APP_ORIGIN}/stripe-cancel`,
};
