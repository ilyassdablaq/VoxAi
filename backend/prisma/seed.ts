import { PrismaClient, PlanInterval, PlanType } from "@prisma/client";

const prisma = new PrismaClient();

function getStripeConfig(planKey: "free" | "pro" | "enterprise") {
  const byPlan = {
    free: {
      productId: process.env.STRIPE_PRODUCT_ID_FREE,
      priceId: process.env.STRIPE_PRICE_ID_FREE,
    },
    pro: {
      productId: process.env.STRIPE_PRODUCT_ID_PRO,
      priceId: process.env.STRIPE_PRICE_ID_PRO_MONTHLY ?? process.env.STRIPE_PRICE_ID_PRO,
    },
    enterprise: {
      productId: process.env.STRIPE_PRODUCT_ID_ENTERPRISE,
      priceId: process.env.STRIPE_PRICE_ID_ENTERPRISE_MONTHLY ?? process.env.STRIPE_PRICE_ID_ENTERPRISE,
    },
  } as const;

  return byPlan[planKey];
}

async function main() {
  await prisma.plan.upsert({
    where: { key: "free" },
    update: {
      type: PlanType.FREE,
      interval: PlanInterval.MONTHLY,
      priceCents: 0,
      voiceMinutes: 30,
      tokenLimit: 20_000,
      features: ["30 voice minutes", "20,000 AI tokens", "Basic support", "1 agent"],
      stripeProductId: getStripeConfig("free").productId,
      stripePriceId: getStripeConfig("free").priceId,
      isActive: true,
    },
    create: {
      key: "free",
      name: "Free",
      type: PlanType.FREE,
      interval: PlanInterval.MONTHLY,
      priceCents: 0,
      voiceMinutes: 30,
      tokenLimit: 20_000,
      features: ["30 voice minutes", "20,000 AI tokens", "Basic support", "1 agent"],
      stripeProductId: getStripeConfig("free").productId,
      stripePriceId: getStripeConfig("free").priceId,
    },
  });

  await prisma.plan.upsert({
    where: { key: "pro" },
    update: {
      type: PlanType.PRO,
      interval: PlanInterval.MONTHLY,
      priceCents: 4900,
      voiceMinutes: 5000,
      tokenLimit: 2_000_000,
      features: ["5000 voice minutes", "Priority support", "Unlimited agents"],
      stripeProductId: getStripeConfig("pro").productId,
      stripePriceId: getStripeConfig("pro").priceId,
      isActive: true,
    },
    create: {
      key: "pro",
      name: "Pro",
      type: PlanType.PRO,
      interval: PlanInterval.MONTHLY,
      priceCents: 4900,
      voiceMinutes: 5000,
      tokenLimit: 2_000_000,
      features: ["5000 voice minutes", "Priority support", "Unlimited agents"],
      stripeProductId: getStripeConfig("pro").productId,
      stripePriceId: getStripeConfig("pro").priceId,
    },
  });

  await prisma.plan.upsert({
    where: { key: "enterprise" },
    update: {
      type: PlanType.ENTERPRISE,
      interval: PlanInterval.MONTHLY,
      priceCents: 9900,
      voiceMinutes: 100000,
      tokenLimit: 10_000_000,
      features: ["Dedicated support", "SLA", "Custom integrations"],
      stripeProductId: getStripeConfig("enterprise").productId,
      stripePriceId: getStripeConfig("enterprise").priceId,
      isActive: true,
    },
    create: {
      key: "enterprise",
      name: "Enterprise",
      type: PlanType.ENTERPRISE,
      interval: PlanInterval.MONTHLY,
      priceCents: 9900,
      voiceMinutes: 100000,
      tokenLimit: 10_000_000,
      features: ["Dedicated support", "SLA", "Custom integrations"],
      stripeProductId: getStripeConfig("enterprise").productId,
      stripePriceId: getStripeConfig("enterprise").priceId,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
