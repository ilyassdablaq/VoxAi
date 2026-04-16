import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ApiError, apiClient } from "@/lib/api-client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SectionHeading from "@/components/SectionHeading";
import { Seo } from "@/components/Seo";

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
};

const Contact = () => {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast({ title: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    setSending(true);

    try {
      await apiClient.post<{ id: string }>("/api/contact", form);
      toast({ title: "Message sent!", description: "We'll get back to you within 24 hours." });
      setSending(false);
      setForm({ name: "", email: "", company: "", message: "" });
    } catch (error) {
      setSending(false);
      const description =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unable to send your message right now.";

      toast({
        title: "Send failed",
        description,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Contact"
        description="Contact VoxAI for product questions, demos, and business partnerships around AI voice chatbots and automation."
        path="/contact"
      />
      <Navbar />

      <section className="pt-28 section-padding">
        <div className="max-w-5xl mx-auto">
          <SectionHeading
            badge="Contact"
            title="Get in touch"
            subtitle="Have questions? Want a demo? We'd love to hear from you."
          />

          <div className="grid md:grid-cols-2 gap-10">
            <motion.div {...fadeUp}>
              <div className="space-y-6">
                <div className="glass rounded-xl p-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-heading font-semibold text-foreground">Email Us</h4>
                    <p className="text-sm text-muted-foreground">ilyassdablaq@outlook.de</p>
                  </div>
                </div>
                <div className="glass rounded-xl p-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-heading font-semibold text-foreground">Live Chat</h4>
                    <p className="text-sm text-muted-foreground">Available Mon–Fri, 9am–6pm EST</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.form {...fadeUp} transition={{ delay: 0.15 }} onSubmit={handleSubmit} className="glass rounded-xl p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Name *</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Email *</label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Company</label>
                <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company name" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Message *</label>
                <Textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tell us about your use case..." />
              </div>
              <Button type="submit" className="w-full glow-primary" disabled={sending}>
                {sending ? "Sending..." : "Send Message"} <Send className="ml-2 w-4 h-4" />
              </Button>
            </motion.form>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Contact;
