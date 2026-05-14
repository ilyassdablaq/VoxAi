import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, Database, LinkIcon, Bot, BarChart3, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { onboardingState } from "@/hooks/use-onboarding";

interface Props {
  onDone: () => void;
}

const STEPS = [
  {
    icon: LayoutDashboard,
    title: "Conversations",
    description: "Create and manage AI voice conversations. Each conversation is a separate session with your bot.",
    path: "/dashboard",
  },
  {
    icon: Database,
    title: "Data Sources",
    description: "Upload documents, URLs, or text to train your bot. The more context you give it, the smarter it becomes.",
    path: "/dashboard/data-sources",
  },
  {
    icon: LinkIcon,
    title: "Integrations",
    description: "Copy your embed snippet and paste it into any website to deploy your chatbot widget in minutes.",
    path: "/dashboard/integrations",
  },
  {
    icon: Bot,
    title: "Voice Controls",
    description: "Customize your bot's voice, speed, and tone. Make it sound exactly how you want.",
    path: "/dashboard/voice",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description: "Track conversations, usage, and user engagement. Available on the Pro plan.",
    path: "/dashboard/analytics",
  },
];

export function DashboardTour({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onboardingState.completeTour();
      onDone();
    } else {
      navigate(STEPS[step + 1].path);
      setStep((s) => s + 1);
    }
  };

  const handleSkip = () => {
    onboardingState.completeTour();
    onDone();
  };

  return (
    <AnimatePresence>
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.25 }}
        className="fixed bottom-6 right-6 z-40 w-80 bg-card border border-border rounded-2xl shadow-xl p-5"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Tour · {step + 1}/{STEPS.length}
              </p>
              <h3 className="text-sm font-bold text-foreground leading-tight">{current.title}</h3>
            </div>
          </div>
          <button onClick={handleSkip} className="text-muted-foreground hover:text-foreground transition-colors p-0.5 -mr-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{current.description}</p>

        {/* Progress dots */}
        <div className="flex gap-1 mb-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full flex-1 transition-all duration-300 ${i <= step ? "bg-primary" : "bg-border"}`}
            />
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="flex-1 text-muted-foreground" onClick={handleSkip}>
            Skip
          </Button>
          <Button size="sm" className="flex-1" onClick={handleNext}>
            {isLast ? "Finish" : "Next"}
            {!isLast && <ChevronRight className="w-3.5 h-3.5 ml-1" />}
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
