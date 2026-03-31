import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check, CreditCard, Lock, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SectionHeading from "@/components/SectionHeading";

const checkoutMethods = [
  {
    title: "Credit / Debit Cards",
    description: "Visa, Mastercard, American Express and other major cards.",
    icon: CreditCard,
  },
  {
    title: "PayPal",
    description: "Available when enabled for your Stripe account and region.",
    icon: Wallet,
  },
  {
    title: "Apple Pay / Google Pay",
    description: "Displayed automatically on supported devices and browsers.",
    icon: Wallet,
  },
  {
    title: "SEPA Direct Debit",
    description: "Supported for eligible EU users and EUR subscription setups.",
    icon: CreditCard,
  },
];

const plans = [
  {
    name: "Free",
    price: "EUR 0",
    period: "forever",
    desc: "Perfect for testing and prototyping.",
    features: ["30 voice minutes/month", "20,000 AI tokens/month", "Basic NLU", "1 voice agent", "Community support", "API access"],
    cta: "Get Started",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "EUR 49",
    period: "/month",
    desc: "For growing teams and businesses.",
    features: ["5,000 voice minutes/month", "Advanced NLU + sentiment", "Unlimited agents", "Priority support", "Analytics dashboard", "Custom voice profiles", "Webhook integrations"],
    cta: "Start Free Trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "EUR 99",
    period: "/month",
    desc: "For large-scale deployments with premium support.",
    features: ["100,000 voice minutes/month", "10,000,000 AI tokens/month", "Dedicated infrastructure", "24/7 premium support", "SLA guarantees", "Data residency options", "SSO & RBAC", "Custom integrations"],
    cta: "Start Enterprise",
    highlighted: false,
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
};

const Pricing = () => (
  <div className="min-h-screen bg-background">
    <Navbar />

    <section className="pt-28 section-padding">
      <div className="max-w-7xl mx-auto">
        <SectionHeading
          badge="Pricing"
          title="Simple, transparent pricing"
          subtitle="Start free, scale as you grow. No hidden fees."
        />

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              {...fadeUp}
              transition={{ delay: i * 0.1 }}
              className={`rounded-xl p-6 flex flex-col ${
                plan.highlighted
                  ? "glass border-primary/40 glow-primary"
                  : "glass"
              }`}
            >
              {plan.highlighted && (
                <span className="inline-block self-start px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-primary/20 text-primary mb-3">
                  Most Popular
                </span>
              )}
              <h3 className="font-heading font-bold text-xl text-foreground">{plan.name}</h3>
              <div className="mt-2 mb-1">
                <span className="text-3xl font-heading font-bold text-foreground">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">{plan.desc}</p>

              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                className={plan.highlighted ? "glow-primary w-full" : "w-full"}
                variant={plan.highlighted ? "default" : "outline"}
                asChild
              >
                <Link to={plan.name === "Enterprise" ? "/contact" : "/sign-up"}>
                  {plan.cta} <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    <section className="section-padding pt-0">
      <div className="max-w-5xl mx-auto space-y-6">
        <SectionHeading
          badge="Checkout"
          title="Payment methods you can trust"
          subtitle="Method availability can vary by country, currency, and device."
        />

        <div className="grid gap-4 md:grid-cols-2">
          {checkoutMethods.map((method, index) => {
            const Icon = method.icon;

            return (
              <motion.div key={method.title} {...fadeUp} transition={{ delay: index * 0.08 }} className="glass rounded-xl p-5">
                <p className="font-heading font-semibold text-foreground flex items-center gap-2">
                  <Icon className="w-4 h-4 text-primary" />
                  {method.title}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{method.description}</p>
              </motion.div>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="glass rounded-xl p-5">
            <p className="font-heading font-semibold text-foreground flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              Secure payment flow
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Transactions run through encrypted Stripe checkout pages to protect payment details in transit.
            </p>
          </motion.div>
          <motion.div {...fadeUp} transition={{ delay: 0.18 }} className="glass rounded-xl p-5">
            <p className="font-heading font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Reliable subscription updates
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Payment success and failure events are synced from Stripe so your subscription state stays accurate.
            </p>
          </motion.div>
        </div>
      </div>
    </section>

    {/* FAQ */}
    <section className="section-padding">
      <div className="max-w-3xl mx-auto">
        <SectionHeading badge="FAQ" title="Frequently asked questions" />
        {[
          { q: "Can I switch plans anytime?", a: "Yes, you can upgrade or downgrade at any time. Changes take effect immediately." },
          { q: "What happens when I exceed my voice minutes?", a: "You'll receive a notification and can upgrade or purchase additional minutes at a per-minute rate." },
          { q: "Is there a free trial for Pro?", a: "Yes! The Pro plan includes a 14-day free trial with full access to all features." },
          { q: "Do you offer annual billing?", a: "Yes, annual billing saves you 20%. Contact sales for enterprise annual agreements." },
        ].map((faq, i) => (
          <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.08 }} className="glass rounded-xl p-5 mb-3">
            <h4 className="font-heading font-semibold text-foreground mb-1">{faq.q}</h4>
            <p className="text-sm text-muted-foreground">{faq.a}</p>
          </motion.div>
        ))}
      </div>
    </section>

    <Footer />
  </div>
);

export default Pricing;
