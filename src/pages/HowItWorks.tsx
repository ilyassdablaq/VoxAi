import { motion } from "framer-motion";
import { Mic, Cpu, MessageSquare, ArrowDown } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SectionHeading from "@/components/SectionHeading";

const steps = [
  {
    icon: Mic,
    num: "01",
    title: "User Speaks",
    desc: "The customer speaks naturally through any channel — web widget, mobile app, phone, or smart speaker. Our low-latency audio capture ensures crystal-clear input.",
  },
  {
    icon: Cpu,
    num: "02",
    title: "AI Processes",
    desc: "Our speech-to-text engine transcribes in real-time. The NLU model extracts intent, entities, and sentiment. The dialogue manager determines the best response.",
  },
  {
    icon: MessageSquare,
    num: "03",
    title: "Bot Responds",
    desc: "A natural, context-aware response is generated and synthesized into lifelike speech. The entire loop completes in under 500ms for a seamless conversation.",
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
};

const HowItWorks = () => (
  <div className="min-h-screen bg-background">
    <Navbar />

    <section className="pt-28 section-padding">
      <div className="max-w-4xl mx-auto">
        <SectionHeading
          badge="How It Works"
          title="From voice to resolution in milliseconds"
          subtitle="Our three-stage pipeline delivers intelligent, real-time conversational AI."
        />

        <div className="space-y-4">
          {steps.map((step, i) => (
            <div key={step.num}>
              <motion.div
                {...fadeUp}
                transition={{ delay: i * 0.15 }}
                className="glass rounded-xl p-8 flex flex-col sm:flex-row items-start gap-6"
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <step.icon className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <span className="text-xs font-heading font-bold text-primary">STEP {step.num}</span>
                  <h3 className="text-xl font-heading font-bold text-foreground mt-1 mb-2">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
              {i < steps.length - 1 && (
                <div className="flex justify-center py-2">
                  <ArrowDown className="w-5 h-5 text-primary/40" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>

    <Footer />
  </div>
);

export default HowItWorks;
