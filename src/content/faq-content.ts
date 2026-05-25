import {
  BarChart3,
  Bot,
  Bug,
  Cable,
  CreditCard,
  Database,
  LifeBuoy,
  MessageCircle,
  Mic,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export type FaqSection = {
  id: string;
  title: string;
  icon: LucideIcon;
  items: FaqItem[];
};

export const FAQ_SECTIONS: FaqSection[] = [
  {
    id: "overview",
    title: "General Overview",
    icon: Settings2,
    items: [
      {
        id: "what-is-platform",
        question: "What is this platform?",
        answer:
          "This platform helps businesses build, train, and run AI chatbots for customer communication. It combines chat, voice, analytics, automation, and integrations in one place.",
      },
      {
        id: "what-users-can-do",
        question: "What can users do with it?",
        answer:
          "You can create conversations, train your bot with business data, file IT support tickets, track performance metrics, configure voice behavior, and connect your chatbot to websites or external tools.",
      },
      {
        id: "who-is-it-for",
        question: "Who is it for?",
        answer:
          "It is built for business teams, support teams, product teams, and developers. Non-technical users can use the dashboard, while technical teams can use API and SDK integrations.",
      },
    ],
  },
  {
    id: "chatbot",
    title: "Chatbot",
    icon: Bot,
    items: [
      {
        id: "create-conversation",
        question: "How do I create a conversation?",
        answer:
          "Go to Dashboard → Conversations, click create, then start chatting. If you leave the title empty, the system creates a default conversation name automatically.",
      },
      {
        id: "interact-chatbot",
        question: "How do I interact with the chatbot?",
        answer:
          "Open any conversation and type your message. The assistant responds in real time and keeps context from recent messages and your trained knowledge data.",
      },
      {
        id: "supported-languages",
        question: "Which languages are supported?",
        answer:
          "The chat UI currently supports English, German, French, and Arabic. Voice recognition uses language-specific locales to improve accuracy.",
      },
    ],
  },
  {
    id: "voice",
    title: "Voice Features",
    icon: Mic,
    items: [
      {
        id: "use-microphone",
        question: "How do I use the microphone?",
        answer:
          "Open a conversation and use the voice input button. Your browser asks for microphone permission. After approval, speech is transcribed and sent as a message.",
      },
      {
        id: "voice-in-out",
        question: "How does voice input/output work?",
        answer:
          "Your speech is converted to text, the AI creates a response, then text-to-speech generates audio output. This all runs in one conversation loop.",
      },
      {
        id: "voice-troubleshooting",
        question: "What if voice is not working?",
        answer:
          "Check browser microphone permissions, selected language, and internet connection. If issues continue, switch to text mode to keep working while you troubleshoot audio settings.",
      },
    ],
  },
  {
    id: "analytics",
    title: "Analytics Dashboard",
    icon: BarChart3,
    items: [
      {
        id: "analytics-metrics",
        question: "What metrics are shown?",
        answer:
          "You can track conversation count, average response time, resolution rate, message volume over time, and sentiment distribution.",
      },
      {
        id: "interpret-analytics",
        question: "How should I interpret the data?",
        answer:
          "Use response time to monitor speed, resolution rate to measure quality, and message volume trends to understand demand. Sentiment helps identify whether user experience is improving.",
      },
    ],
  },
  {
    id: "support",
    title: "IT Support & Tickets",
    icon: LifeBuoy,
    items: [
      {
        id: "what-is-it-support",
        question: "What is IT Support?",
        answer:
          "IT Support is a ticketing area inside your dashboard. Customers describe a problem or complaint and a structured support ticket is created with category, priority, and status.",
      },
      {
        id: "how-to-file-ticket",
        question: "How do I file a complaint or ticket?",
        answer:
          "Open Dashboard → IT Support, fill in the subject and description, pick a category (technical, billing, integration, etc.) and a priority, then submit. The ticket appears in your active list until it is resolved.",
      },
      {
        id: "ticket-statuses",
        question: "What ticket statuses exist?",
        answer:
          "Tickets move through Open, In Progress, Resolved, and Closed. You can close a ticket yourself once your issue is solved, or delete resolved tickets from the history.",
      },
    ],
  },
  {
    id: "tts",
    title: "Text-to-Speech",
    icon: MessageCircle,
    items: [
      {
        id: "enable-voice-output",
        question: "How do I enable voice output?",
        answer:
          "Go to Dashboard → Voice Controls and choose your TTS provider and voice profile. Saved settings are applied to generated assistant audio.",
      },
      {
        id: "tts-customization",
        question: "What can I customize?",
        answer:
          "You can set voice selection, speed, style, and stability. This lets you tune how natural, expressive, or consistent the assistant voice sounds.",
      },
    ],
  },
  {
    id: "api-integrations",
    title: "API & Integration",
    icon: Cable,
    items: [
      {
        id: "developer-vs-widget",
        question: "What is the difference between Developer Feature and Widget Integration?",
        answer:
          "Developer Feature is API-first and headless: your team builds custom UI and backend logic. Widget Integration is plug-and-play: paste one script and use a ready chatbot UI on your website.",
      },
      {
        id: "website-integration",
        question: "How do I integrate the chatbot into a website?",
        answer:
          "Open Dashboard → Integrations, configure your bot, copy the embed script, and paste it before the closing body tag of your website.",
      },
      {
        id: "basic-api-usage",
        question: "What is a basic API usage example?",
        answer:
          "Create an API key in Developer, send a REST request with your key and message payload, then render the returned response in your own application interface.",
      },
    ],
  },
  {
    id: "privacy-security",
    title: "Data Privacy & Security",
    icon: ShieldCheck,
    items: [
      {
        id: "how-data-is-handled",
        question: "How do you handle my conversations and uploaded data?",
        answer:
          "Your conversations and uploaded files are processed through secure services, and your data stays tied to your own account. One customer cannot access another customer’s data.",
      },
      {
        id: "ai-provider-data-usage",
        question: "How is my data used with AI providers like OpenAI?",
        answer:
          "We send only the data needed to generate your response. Customer data is not used to train the model, and providers process it only for the request lifecycle under their API policies.",
      },
      {
        id: "encryption-controls",
        question: "Is my data encrypted and can I delete it?",
        answer:
          "Yes. Data is protected in transit with HTTPS, and storage protections are applied in our infrastructure. You can delete conversations, and you can request account deletion to remove your workspace data.",
      },
    ],
  },
  {
    id: "subscriptions",
    title: "Subscription Plans",
    icon: CreditCard,
    items: [
      {
        id: "plans-available",
        question: "What plans are available?",
        answer:
          "You can choose Free, Pro, and Enterprise tiers. Each plan scales usage limits, performance capacity, and support level.",
      },
      {
        id: "plan-features",
        question: "What is included in each plan?",
        answer:
          "Free is ideal for testing and small workloads. Pro adds higher usage limits, advanced controls, and priority support. Enterprise adds custom limits, dedicated onboarding, and premium support similar to enterprise voice AI platforms.",
      },
      {
        id: "upgrade-plan",
        question: "How do I upgrade my plan?",
        answer:
          "Go to Dashboard → Subscriptions, select a target plan, and confirm the change. Your active subscription is updated immediately in your account.",
      },
    ],
  },
  {
    id: "training",
    title: "Data Upload & AI Training",
    icon: Database,
    items: [
      {
        id: "upload-types",
        question: "Which data types can I upload?",
        answer:
          "You can upload PDF files, text files, structured JSON/XML content, and website URLs for automatic crawling.",
      },
      {
        id: "what-happens-after-upload",
        question: "What happens after I upload data?",
        answer:
          "The system extracts text, splits it into smaller chunks, and stores searchable context. During conversations, the assistant retrieves relevant chunks to answer with your business knowledge.",
      },
      {
        id: "how-training-improves-answers",
        question: "How does this improve chatbot answers?",
        answer:
          "Training gives the assistant factual context about your products, policies, and processes. This makes answers more accurate, specific, and aligned with your business.",
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    icon: Bug,
    items: [
      {
        id: "chatbot-not-responding",
        question: "The chatbot is not responding. What should I check?",
        answer:
          "Check internet connectivity, account authentication, and conversation status. If needed, refresh the page and retry in a new conversation.",
      },
      {
        id: "voice-not-working",
        question: "Voice is not working. What should I do?",
        answer:
          "Verify microphone access, selected language, and browser support. For fast continuity, switch to text while investigating audio setup.",
      },
      {
        id: "api-key-issues",
        question: "My API key is rejected. What should I do?",
        answer:
          "Make sure the key is active, correctly copied, and sent in the expected header format. If needed, revoke and generate a fresh key from Developer settings.",
      },
      {
        id: "subscription-issues",
        question: "My subscription features are missing. What should I check?",
        answer:
          "Open the Subscriptions page to confirm your active plan status. If usage limits were reached or plan sync is delayed, refresh and retry; then contact support if the issue remains.",
      },
    ],
  },
];
