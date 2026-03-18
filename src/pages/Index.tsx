import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Mic, Zap, Globe, Shield, BarChart3, Code2, ArrowRight, Star } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VoiceDemoWidget from "@/components/VoiceDemoWidget";
import SectionHeading from "@/components/SectionHeading";

const features = [
  { icon: Mic, title: "Real-Time Voice", desc: "Speech-to-text and text-to-speech with sub-second latency." },
  { icon: Zap, title: "Natural Language Understanding", desc: "Advanced NLU that understands context, intent, and sentiment." },
  { icon: Globe, title: "Multi-Language", desc: "Support for 30+ languages with automatic detection." },
  { icon: Code2, title: "API Integration", desc: "RESTful API and WebSocket support for seamless integration." },
  { icon: BarChart3, title: "Analytics Dashboard", desc: "Real-time insights into conversations, resolution rates, and more." },
  { icon: Shield, title: "Enterprise Security", desc: "SOC 2 compliant, end-to-end encryption, and data residency options." },
];

const steps = [
  { num: "01", title: "User Speaks", desc: "Customer speaks naturally via web, mobile, or phone." },
  { num: "02", title: "AI Processes", desc: "Our engine transcribes, understands intent, and generates a response." },
  { num: "03", title: "Bot Responds", desc: "The AI responds in real-time with natural, human-like speech." },
];

const testimonials = [
  { name: "Sarah Chen", role: "CTO, TechFlow", quote: "VoxAI reduced our support costs by 60% while improving customer satisfaction scores.", stars: 5 },
  { name: "Marcus Johnson", role: "VP Support, Retail Co", quote: "The voice quality is indistinguishable from human agents. Our customers love it.", stars: 5 },
  { name: "Elena Rodriguez", role: "Founder, StartupX", quote: "Integration took less than an hour. The API documentation is phenomenal.", stars: 5 },
];

const logos = ["Stripe", "Shopify", "Slack", "Notion", "Linear", "Vercel"];

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
};

const Index = () => (
  <div className="min-h-screen bg-background">
    <Navbar />

    {/* Hero */}
    <section className="relative pt-32 pb-20 section-padding overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 right-0 w-[300px] h-[300px] bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div {...fadeUp} className="relative z-10">
            <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary border border-primary/20 mb-6">
              Now in Public Beta
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold leading-tight">
              Conversational AI
              <br />
              <span className="text-gradient">Voice Platform</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-lg">
              Build intelligent voice bots that understand, respond, and resolve in real-time. Customer support, automation, and productivity — powered by AI.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="glow-primary" asChild>
                <Link to="/contact">
                  Start Free Trial <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/how-it-works">See How It Works</Link>
              </Button>
            </div>
          </motion.div>

          <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
            <VoiceDemoWidget />
          </motion.div>
        </div>

        {/* Trust logos */}
        <motion.div {...fadeUp} transition={{ delay: 0.4 }} className="mt-20 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-6">Trusted by innovative teams</p>
          <div className="flex flex-wrap justify-center gap-8 opacity-40">
            {logos.map((logo) => (
              <span key={logo} className="font-heading font-semibold text-lg text-foreground">{logo}</span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>

    {/* Features */}
    <section className="section-padding bg-card/30">
      <div className="max-w-7xl mx-auto">
        <SectionHeading badge="Features" title="Everything you need for voice AI" subtitle="A complete platform for building, deploying, and managing conversational voice bots." />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              {...fadeUp}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-xl p-6 hover:border-primary/30 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:glow-primary transition-shadow">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-heading font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* How It Works */}
    <section className="section-padding">
      <div className="max-w-7xl mx-auto">
        <SectionHeading badge="How It Works" title="Three simple steps" subtitle="From voice input to intelligent response in milliseconds." />
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((s, i) => (
            <motion.div key={s.num} {...fadeUp} transition={{ delay: i * 0.15 }} className="text-center">
              <div className="text-5xl font-heading font-bold text-gradient mb-4">{s.num}</div>
              <h3 className="font-heading font-semibold text-lg text-foreground mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* Testimonials */}
    <section className="section-padding bg-card/30">
      <div className="max-w-7xl mx-auto">
        <SectionHeading badge="Testimonials" title="Loved by teams worldwide" />
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div key={t.name} {...fadeUp} transition={{ delay: i * 0.1 }} className="glass rounded-xl p-6">
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-sm text-foreground mb-4">"{t.quote}"</p>
              <div>
                <p className="text-sm font-semibold text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="section-padding">
      <div className="max-w-3xl mx-auto text-center">
        <motion.div {...fadeUp}>
          <h2 className="text-3xl sm:text-4xl font-heading font-bold text-foreground mb-4">
            Ready to transform your customer experience?
          </h2>
          <p className="text-muted-foreground mb-8">Start your free trial today. No credit card required.</p>
          <Button size="lg" className="glow-primary" asChild>
            <Link to="/contact">Get Started Free <ArrowRight className="ml-2 w-4 h-4" /></Link>
          </Button>
        </motion.div>
      </div>
    </section>

    <Footer />
  </div>
);

export default Index;
