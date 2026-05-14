import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const TermsOfService = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <Navbar />
    <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-heading font-bold text-foreground mb-2">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-10">Last updated: May 2025</p>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-8 text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">1. Acceptance of Terms</h2>
          <p>
            By creating an account or using the VoxAI platform, you agree to these Terms of Service. If you do
            not agree, please do not use our services.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">2. Description of Service</h2>
          <p>
            VoxAI provides an AI-powered conversational voice platform that allows users to create and embed
            chatbot widgets on their websites. Features vary by subscription plan.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">3. Account Responsibilities</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You must be at least 16 years old to use VoxAI.</li>
            <li>You are responsible for maintaining the confidentiality of your credentials.</li>
            <li>You must not share your account or embed key with unauthorized parties.</li>
            <li>You are responsible for all activity that occurs under your account.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">4. Acceptable Use</h2>
          <p>You agree not to use VoxAI to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Violate any applicable law or regulation.</li>
            <li>Distribute spam, malware, or harmful content.</li>
            <li>Attempt to reverse-engineer, scrape, or disrupt the platform.</li>
            <li>Impersonate any person or entity.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">5. Subscriptions & Billing</h2>
          <p>
            Paid plans are billed monthly or annually as selected at checkout. You may cancel at any time;
            cancellations take effect at the end of the current billing period. We do not offer refunds for
            partial periods except where required by law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">6. Intellectual Property</h2>
          <p>
            All platform code, branding, and materials are the property of VoxAI. Content you create (conversation
            transcripts, knowledge base entries) remains yours. You grant us a limited licence to process that content
            solely to deliver the service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">7. Service Availability</h2>
          <p>
            We aim for high availability but do not guarantee uninterrupted service. We may perform scheduled
            maintenance with advance notice where possible.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">8. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, VoxAI shall not be liable for indirect, incidental, or
            consequential damages arising from your use of the service. Our total liability shall not exceed the
            amount you paid in the 12 months preceding the claim.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">9. Termination</h2>
          <p>
            We reserve the right to suspend or terminate accounts that violate these terms. You may close your
            account at any time from your profile settings.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">10. Changes to Terms</h2>
          <p>
            We may update these terms. We will notify you by email at least 14 days before material changes
            take effect. Continued use after that date constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">11. Contact</h2>
          <p>
            For legal enquiries, contact us via our{" "}
            <Link to="/contact" className="text-primary hover:underline">contact page</Link> or at{" "}
            <a href="mailto:legal@voxai.app" className="text-primary hover:underline">legal@voxai.app</a>.
          </p>
        </section>
      </div>
    </main>
    <Footer />
  </div>
);

export default TermsOfService;
