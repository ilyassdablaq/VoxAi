import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Bot, Database, Globe, Mic, PlugZap, ShoppingBag, LifeBuoy, Building2, Check } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SectionHeading from "@/components/SectionHeading";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";

const steps = [
  {
    title: "Create your chatbot",
    description: "Set your chatbot name, tone, and behavior from your dashboard in minutes.",
  },
  {
    title: "Train with your data",
    description: "Upload PDF/TXT/JSON/XML files or crawl your website URL to build your knowledge base.",
  },
  {
    title: "Embed on your website",
    description: "Paste one script and your AI chatbot is live for customers instantly.",
  },
];

const features = [
  {
    icon: Bot,
    title: "AI Chat + RAG",
    description: "Accurate, context-aware responses grounded in your own business data.",
  },
  {
    icon: Mic,
    title: "Voice-ready",
    description: "Speech-to-text and text-to-speech for natural customer conversations.",
  },
  {
    icon: PlugZap,
    title: "Integrations",
    description: "Website widget, API endpoints, and customizable embed settings.",
  },
  {
    icon: Database,
    title: "Data training",
    description: "Multi-format ingestion pipeline with chunking, embeddings, and vector retrieval.",
  },
];

const useCases = [
  {
    icon: ShoppingBag,
    title: "E-commerce",
    description: "Handle product questions, shipping policies, and order-related FAQs 24/7.",
  },
  {
    icon: LifeBuoy,
    title: "Customer support",
    description: "Automate repetitive support questions while keeping responses on-brand.",
  },
  {
    icon: Building2,
    title: "SaaS products",
    description: "Guide users through onboarding, feature discovery, and troubleshooting flows.",
  },
];

const pricingPreview = [
  { name: "Free", price: "EUR 0", note: "Best to get started", points: ["Basic widget", "Core AI chat", "Starter limits"] },
  { name: "Pro", price: "EUR 49/mo", note: "For growing businesses", points: ["Higher usage", "Advanced features", "Priority support"] },
  { name: "Enterprise", price: "EUR 99/mo", note: "For scale and security", points: ["Custom SLAs", "Dedicated support", "Custom integrations"] },
];

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
};

const homeStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "VoxAI",
      url: "https://voxflow-ai-site.vercel.app/",
      logo: "https://voxflow-ai-site.vercel.app/og-image.svg",
      sameAs: [],
    },
    {
      "@type": "WebSite",
      name: "VoxAI",
      url: "https://voxflow-ai-site.vercel.app/",
      inLanguage: "en",
    },
    {
      "@type": "SoftwareApplication",
      name: "VoxAI",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: "https://voxflow-ai-site.vercel.app/",
      description:
        "AI voice chatbot platform for support, sales, and workflow automation.",
      offers: [
        {
          "@type": "Offer",
          name: "Free",
          price: "0",
          priceCurrency: "EUR",
        },
        {
          "@type": "Offer",
          name: "Pro",
          price: "49",
          priceCurrency: "EUR",
        },
      ],
    },
  ],
};

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="AI Voice Chatbots for Business Growth"
        description="Build, train, and launch an AI voice chatbot with speech-to-text, text-to-speech, RAG, and one-line website embedding."
        path="/"
        structuredData={homeStructuredData}
      />
      <Navbar />

      <section className="min-h-screen flex items-center justify-center section-padding relative overflow-hidden">
        <div className="absolute inset-0 mx-auto h-80 w-[46rem] rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="max-w-7xl mx-auto relative w-full">
          <motion.div {...fadeUp} className="max-w-4xl mx-auto text-center">
            <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary border border-primary/20 mb-6">
              AI Chatbot as a Service for Businesses
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold leading-tight">
              Build, train, and launch your
              <span className="text-gradient"> business AI chatbot</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto">
              Create your own chatbot, train it with your business data, and embed it on your website with a single script.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button size="lg" className="glow-primary" asChild>
                <Link to="/sign-up">
                  Get Started <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/sign-in">Sign In</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="section-padding bg-card/30">
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            badge="How It Works"
            title="Launch in 3 simple steps"
            subtitle="A simple workflow designed for non-technical teams."
          />
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((step, index) => (
              <motion.div key={step.title} {...fadeUp} transition={{ delay: index * 0.1 }} className="glass rounded-xl p-6">
                <p className="text-xs font-semibold text-primary mb-3">STEP {index + 1}</p>
                <h3 className="font-heading font-semibold text-lg text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            badge="Features"
            title="Everything needed for chatbot SaaS"
            subtitle="Built for reliability, fast setup, and real customer workflows."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((feature, index) => (
              <motion.div key={feature.title} {...fadeUp} transition={{ delay: index * 0.08 }} className="glass rounded-xl p-5">
                <feature.icon className="w-5 h-5 text-primary mb-3" />
                <h3 className="font-heading font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding bg-card/30">
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            badge="Use Cases"
            title="Built for real business teams"
            subtitle="Use AI chatbots across support, sales, and product experiences."
          />
          <div className="grid md:grid-cols-3 gap-6">
            {useCases.map((item, index) => (
              <motion.div key={item.title} {...fadeUp} transition={{ delay: index * 0.08 }} className="glass rounded-xl p-6">
                <item.icon className="w-5 h-5 text-primary mb-3" />
                <h3 className="font-heading font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="max-w-7xl mx-auto">
          <SectionHeading badge="Pricing" title="Simple plans for every stage" subtitle="Start free and upgrade as your chatbot usage grows." />
          <div className="grid md:grid-cols-3 gap-6">
            {pricingPreview.map((plan, index) => (
              <motion.div key={plan.name} {...fadeUp} transition={{ delay: index * 0.08 }} className="glass rounded-xl p-6">
                <h3 className="font-heading font-semibold text-xl text-foreground">{plan.name}</h3>
                <p className="text-3xl font-bold mt-2">{plan.price}</p>
                <p className="text-sm text-muted-foreground mt-1">{plan.note}</p>
                <ul className="mt-4 space-y-2">
                  {plan.points.map((point) => (
                    <li key={point} className="text-sm text-muted-foreground flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      {point}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button variant="outline" asChild>
              <Link to="/pricing">See full pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="section-padding border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-heading font-bold text-foreground mb-4">Start building your AI chatbot today</h2>
          <p className="text-muted-foreground mb-7">Upload your data, train your bot, and deploy on your website in minutes.</p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Button className="glow-primary" size="lg" asChild>
              <Link to="/sign-up">Get Started</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/sign-up">Create Your Chatbot</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
