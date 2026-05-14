import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const PrivacyPolicy = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <Navbar />
    <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-heading font-bold text-foreground mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-10">Last updated: May 2025</p>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-8 text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">1. Who We Are</h2>
          <p>
            VoxAI ("we", "us", or "our") operates the VoxAI platform, an AI-powered conversational voice service.
            This Privacy Policy explains how we collect, use, and protect your personal data when you use our services.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">2. Data We Collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-foreground">Account data:</strong> name, email address, and password (stored as a secure hash).</li>
            <li><strong className="text-foreground">Conversation data:</strong> messages and transcripts generated during your sessions.</li>
            <li><strong className="text-foreground">Usage data:</strong> request counts, token usage, and session durations for billing and analytics.</li>
            <li><strong className="text-foreground">Technical data:</strong> IP address, browser type, and device information for security and diagnostics.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">3. How We Use Your Data</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To provide, maintain, and improve our services.</li>
            <li>To process payments and manage your subscription.</li>
            <li>To send transactional emails (e.g., password resets, billing receipts).</li>
            <li>To detect fraud and ensure platform security.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">4. Data Sharing</h2>
          <p>
            We do not sell your personal data. We share data only with trusted service providers (e.g., payment
            processors, cloud infrastructure) strictly to operate our service, and only under confidentiality agreements.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">5. Data Retention</h2>
          <p>
            We retain your account data for as long as your account is active. Conversation data is retained for
            90 days after session end, unless you delete it earlier. You may request deletion of your data at any time.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">6. Your Rights</h2>
          <p>
            Depending on your location you may have the right to access, correct, export, or delete your personal
            data. To exercise any right, contact us at{" "}
            <a href="mailto:privacy@voxai.app" className="text-primary hover:underline">privacy@voxai.app</a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">7. Cookies</h2>
          <p>
            We use strictly necessary cookies for authentication (HTTP-only, secure). We do not use advertising
            or tracking cookies.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">8. Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. We will notify registered users of material changes by
            email at least 14 days in advance.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">9. Contact</h2>
          <p>
            Questions? Reach us via our{" "}
            <Link to="/contact" className="text-primary hover:underline">contact page</Link> or at{" "}
            <a href="mailto:privacy@voxai.app" className="text-primary hover:underline">privacy@voxai.app</a>.
          </p>
        </section>
      </div>
    </main>
    <Footer />
  </div>
);

export default PrivacyPolicy;
