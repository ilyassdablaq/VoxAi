import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bot, Code2, PartyPopper, ChevronRight, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { integrationService } from "@/services/integration.service";
import { useAuth } from "@/hooks/use-auth";
import { onboardingState } from "@/hooks/use-onboarding";
import { API_BASE } from "@/lib/api-config";

interface Props {
  onDone: () => void;
}

const STEPS = [
  { icon: Bot, title: "Name your chatbot", subtitle: "How should visitors see your bot?" },
  { icon: Code2, title: "Embed it anywhere", subtitle: "Copy the snippet and paste it into your website." },
  { icon: PartyPopper, title: "You're all set!", subtitle: "Your chatbot is live and ready to talk." },
];

export function OnboardingWizard({ onDone }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [botName, setBotName] = useState("Chatbot");
  const [language, setLanguage] = useState("en");
  const [copied, setCopied] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["integration-settings-onboarding"],
    queryFn: () => integrationService.getSettings(),
    enabled: step === 1,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      integrationService.updateSettings({
        botName,
        themeColor: "#5A67D8",
        themeMode: "light",
        position: "bottom-right",
        language,
        launcherText: "Chat",
        launcherIcon: "chat",
        initialBotMessage: "Hi! How can I help you today?",
        maxSessionQuestions: 3,
        microphoneEnabled: false,
        consentRequired: true,
        privacyPolicyUrl: "",
        supportEnabled: false,
      }),
    onSuccess: () => setStep(1),
  });

  const scriptSnippet = settings
    ? `<script src="https://voxflow-ai-site.vercel.app/chatbot.js" data-embed-key="${settings.embedKey}" data-api-base="${API_BASE}" data-bot-name="${settings.botName}" data-language="${settings.language}"></script>`
    : "";

  const handleCopy = async () => {
    if (!scriptSnippet) return;
    await navigator.clipboard.writeText(scriptSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFinish = () => {
    onboardingState.completeWizard();
    onDone();
  };

  const StepIcon = STEPS[step].icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        {/* Progress bar */}
        <div className="h-1 bg-border">
          <motion.div
            className="h-full bg-primary"
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        <div className="p-8">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mb-4">
              <StepIcon className="w-7 h-7 text-primary" />
            </div>
            {step === 0 && user && (
              <p className="text-sm text-muted-foreground mb-1">Welcome, {user.fullName.split(" ")[0]}!</p>
            )}
            <h2 className="text-xl font-bold text-foreground">{STEPS[step].title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{STEPS[step].subtitle}</p>
          </div>

          {/* Step content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {step === 0 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Bot Name</label>
                    <Input
                      value={botName}
                      onChange={(e) => setBotName(e.target.value)}
                      placeholder="e.g. Support Assistant"
                      maxLength={40}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Default Language</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                    >
                      <option value="en">English</option>
                      <option value="de">Deutsch</option>
                      <option value="fr">Français</option>
                      <option value="ar">العربية</option>
                    </select>
                  </div>
                  <Button
                    className="w-full mt-2"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending || !botName.trim()}
                  >
                    {saveMutation.isPending ? "Saving…" : "Continue"}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Paste this snippet just before the <code className="text-primary">&lt;/body&gt;</code> tag of your website.
                  </p>
                  <div className="relative">
                    <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                      {scriptSnippet || "Loading…"}
                    </pre>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={handleCopy}
                      disabled={!scriptSnippet}
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                  <Button className="w-full" onClick={() => setStep(2)}>
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3 text-center">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    {[
                      { label: "Bot created", ok: true },
                      { label: "Snippet ready", ok: true },
                      { label: "First conversation", ok: false },
                    ].map(({ label, ok }) => (
                      <div key={label} className={`rounded-lg border p-3 ${ok ? "border-green-500/30 bg-green-500/5" : "border-primary/30 bg-primary/5"}`}>
                        <div className="text-lg mb-1">{ok ? "✓" : "→"}</div>
                        <p className="text-xs text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                  <Button className="w-full mt-4" onClick={handleFinish}>
                    Go to Dashboard
                  </Button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Step dots */}
          <div className="flex justify-center gap-1.5 mt-6">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? "w-5 bg-primary" : "w-1.5 bg-border"}`}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
