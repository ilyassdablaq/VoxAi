import { motion } from "framer-motion";
import { Mic, Brain, Globe, Code2, BarChart3, Shield, Headphones, Workflow } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SectionHeading from "@/components/SectionHeading";
import { Seo } from "@/components/Seo";

const features = [
  { icon: Mic, title: "Real-Time Speech-to-Text", desc: "Industry-leading accuracy with sub-200ms latency. Supports 30+ languages with automatic detection and dialect handling." },
  { icon: Headphones, title: "Text-to-Speech", desc: "Natural, human-like voice synthesis with customizable voice profiles, tone, speed, and emotional expression." },
  { icon: Brain, title: "Natural Language Understanding", desc: "Deep contextual understanding of user intent, sentiment analysis, and entity extraction powered by large language models." },
  { icon: Globe, title: "Multi-Language Support", desc: "Seamlessly handle conversations in 30+ languages with automatic language detection and real-time translation." },
  { icon: Code2, title: "API & SDK Integration", desc: "RESTful API, WebSocket streaming, and SDKs for JavaScript, Python, and more. Integrate in minutes." },
  { icon: BarChart3, title: "Analytics Dashboard", desc: "Track conversation metrics, resolution rates, sentiment trends, and agent performance in real-time." },
  { icon: Shield, title: "Enterprise Security", desc: "SOC 2 Type II compliant, end-to-end encryption, GDPR ready, with configurable data residency." },
  { icon: Workflow, title: "Workflow Automation", desc: "Connect to your CRM, helpdesk, and business tools. Automate ticket creation, escalation, and follow-ups." },
];

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
};

const Features = () => (
  <div className="min-h-screen bg-background">
    <Seo
      title="Features"
      description="Explore VoxAI features including real-time speech-to-text, text-to-speech, multilingual support, APIs, analytics, and enterprise security."
      path="/features"
    />
    <Navbar />

    <section className="pt-28 section-padding">
      <div className="max-w-7xl mx-auto">
        <SectionHeading
          badge="Features"
          title="Powerful capabilities for every use case"
          subtitle="From real-time voice processing to enterprise-grade security, VoxAI provides everything you need to build intelligent voice experiences."
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-5 sm:gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              {...fadeUp}
              transition={{ delay: i * 0.08 }}
              className="glass rounded-xl p-6 hover:border-primary/30 transition-colors group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:glow-primary transition-shadow">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-lg text-foreground mb-1">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    <Footer />
  </div>
);

export default Features;
