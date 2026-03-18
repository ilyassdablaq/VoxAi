import { motion } from "framer-motion";
import { Code2, Key, Terminal } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SectionHeading from "@/components/SectionHeading";

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
};

const jsSnippet = `import VoxAI from '@voxai/sdk';

const client = new VoxAI({
  apiKey: 'your-api-key'
});

// Start a voice conversation
const session = await client.conversations.create({
  agentId: 'agent_abc123',
  language: 'en',
  onTranscript: (text) => console.log('User:', text),
  onResponse: (text) => console.log('Bot:', text),
});

session.start();`;

const pySnippet = `import voxai

client = voxai.Client(api_key="your-api-key")

# Transcribe audio file
transcript = client.transcribe(
    file="customer_call.wav",
    language="en",
    diarize=True
)

print(transcript.text)
print(transcript.speakers)`;

const curlSnippet = `curl -X POST https://api.voxai.com/v1/conversations \\
  -H "Authorization: Bearer your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "agent_abc123",
    "language": "en",
    "mode": "voice"
  }'`;

const CodeBlock = ({ code, lang }: { code: string; lang: string }) => (
  <div className="glass rounded-xl overflow-hidden">
    <div className="px-4 py-2 border-b border-border flex items-center gap-2">
      <Terminal className="w-3.5 h-3.5 text-primary" />
      <span className="text-xs text-muted-foreground font-mono">{lang}</span>
    </div>
    <pre className="p-4 overflow-x-auto text-sm font-mono text-foreground leading-relaxed">
      <code>{code}</code>
    </pre>
  </div>
);

const ApiDocs = () => (
  <div className="min-h-screen bg-background">
    <Navbar />

    <section className="pt-28 section-padding">
      <div className="max-w-5xl mx-auto">
        <SectionHeading
          badge="Developer API"
          title="Build with VoxAI"
          subtitle="RESTful API, WebSocket streaming, and SDKs for rapid integration."
        />

        {/* Auth */}
        <motion.div {...fadeUp} className="glass rounded-xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Key className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-foreground">Authentication</h3>
              <p className="text-sm text-muted-foreground">All API requests require a Bearer token in the Authorization header.</p>
            </div>
          </div>
          <code className="block bg-secondary rounded-lg px-4 py-2 text-sm font-mono text-foreground">
            Authorization: Bearer your-api-key
          </code>
        </motion.div>

        {/* Endpoints */}
        <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="mb-8">
          <h3 className="font-heading font-semibold text-lg text-foreground mb-4 flex items-center gap-2">
            <Code2 className="w-5 h-5 text-primary" /> API Endpoints
          </h3>
          <div className="space-y-3">
            {[
              { method: "POST", path: "/v1/conversations", desc: "Create a new voice conversation session" },
              { method: "POST", path: "/v1/transcribe", desc: "Transcribe an audio file" },
              { method: "GET", path: "/v1/agents", desc: "List all voice agents" },
              { method: "POST", path: "/v1/tts", desc: "Convert text to speech" },
              { method: "GET", path: "/v1/analytics", desc: "Retrieve conversation analytics" },
            ].map((ep) => (
              <div key={ep.path} className="glass rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                  ep.method === "POST" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"
                }`}>
                  {ep.method}
                </span>
                <code className="text-sm font-mono text-foreground">{ep.path}</code>
                <span className="text-sm text-muted-foreground sm:ml-auto">{ep.desc}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Code examples */}
        <motion.div {...fadeUp} transition={{ delay: 0.2 }} className="space-y-6">
          <h3 className="font-heading font-semibold text-lg text-foreground">Code Examples</h3>
          <CodeBlock code={jsSnippet} lang="JavaScript" />
          <CodeBlock code={pySnippet} lang="Python" />
          <CodeBlock code={curlSnippet} lang="cURL" />
        </motion.div>
      </div>
    </section>

    <Footer />
  </div>
);

export default ApiDocs;
