import { MessageCircle, MessageSquare, Mic, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatWidgetPreviewProps {
  botName: string;
  themeColor: string;
  themeMode: "light" | "dark";
  position: "bottom-right" | "bottom-left";
  language: string;
  launcherText: string;
  launcherIcon: "chat" | "message" | "sparkles" | "none";
  initialBotMessage: string;
  maxSessionQuestions: number;
  microphoneEnabled: boolean;
  consentRequired: boolean;
  privacyPolicyUrl: string;
  loadingStyle?: "free" | "pro" | "enterprise";
}

const LEGACY_DEFAULT_INITIAL_BOT_MESSAGE = "Hi. Send me a message and I will reply here.";

function splitWelcomeMessages(initialBotMessage: string) {
  return initialBotMessage
    .split(/\n\s*\n/)
    .map((message) => message.trim())
    .filter(Boolean);
}

function getLocalizedCopy(language: string, botName: string) {
  const normalizedLanguage = language.toLowerCase();

  if (normalizedLanguage.startsWith("de")) {
    return {
      defaultWelcomeMessages: [`Herzlich willkommen bei ${botName}.`, "Wie koennen wir Ihnen helfen?"],
      consentLead: "Um Ihnen die gewuenschten Inhalte zu liefern, muessen wir Ihre personenbezogenen Daten speichern und verarbeiten. Informationen zu unserem Datenschutz finden Sie in unserer ",
      consentLinkLabel: "Datenschutzrichtlinie",
      consentTail: ".",
      consentButtonLabel: "Ich stimme zu",
      inputPlaceholder: "Nachricht eingeben...",
      sendLabel: "Senden",
      sampleUserMessage: "Ich habe eine Frage zu meinem Produkt.",
      sampleAssistantMessage: "Gern. Sobald der Besucher zustimmt, kann der Chat direkt im Widget starten.",
    };
  }

  if (normalizedLanguage.startsWith("fr")) {
    return {
      defaultWelcomeMessages: [`Bienvenue chez ${botName}.`, "Comment pouvons-nous vous aider ?"],
      consentLead: "Afin de fournir le contenu demande, nous devons stocker et traiter certaines donnees personnelles. Plus d'informations sur notre traitement des donnees sont disponibles dans notre ",
      consentLinkLabel: "politique de confidentialite",
      consentTail: ".",
      consentButtonLabel: "J'accepte",
      inputPlaceholder: "Saisissez votre message...",
      sendLabel: "Envoyer",
      sampleUserMessage: "J'ai une question sur mon produit.",
      sampleAssistantMessage: "Bien sur. Des que le visiteur accepte, la conversation peut commencer dans le widget.",
    };
  }

  return {
    defaultWelcomeMessages: [`Welcome to ${botName}.`, "How can we help you today?"],
    consentLead: "To provide the requested content, we need to store and process personal data. More information about our privacy practices is available in our ",
    consentLinkLabel: "Privacy Policy",
    consentTail: ".",
    consentButtonLabel: "I agree",
    inputPlaceholder: "Type your message...",
    sendLabel: "Send",
    sampleUserMessage: "I have a question about my product.",
    sampleAssistantMessage: "Absolutely. Once the visitor agrees, the conversation can start right inside the widget.",
  };
}

function buildWelcomeMessages(initialBotMessage: string, language: string, botName: string, consentRequired: boolean) {
  const messages = splitWelcomeMessages(initialBotMessage);
  const localizedCopy = getLocalizedCopy(language, botName);

  if (
    consentRequired &&
    (messages.length === 0 || (messages.length === 1 && messages[0] === LEGACY_DEFAULT_INITIAL_BOT_MESSAGE))
  ) {
    return localizedCopy.defaultWelcomeMessages;
  }

  return messages.length > 0 ? messages : [LEGACY_DEFAULT_INITIAL_BOT_MESSAGE];
}

function isLightColor(color: string) {
  if (typeof color !== "string") {
    return false;
  }

  const normalized = color.replace("#", "");
  const expanded = normalized.length === 3 ? normalized.split("").map((char) => char + char).join("") : normalized;
  const numeric = Number.parseInt(expanded.slice(0, 6), 16);

  if (Number.isNaN(numeric)) {
    return false;
  }

  const red = (numeric >> 16) & 255;
  const green = (numeric >> 8) & 255;
  const blue = numeric & 255;
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.64;
}

export function ChatWidgetPreview({
  botName,
  themeColor,
  themeMode,
  position,
  language,
  launcherText,
  launcherIcon,
  initialBotMessage,
  maxSessionQuestions,
  microphoneEnabled,
  consentRequired,
  privacyPolicyUrl,
  loadingStyle = "free",
}: ChatWidgetPreviewProps) {
  const textTone = isLightColor(themeColor) ? "#0f172a" : "#ffffff";
  const accentTone = isLightColor(themeColor) ? "rgba(15, 23, 42, 0.18)" : "rgba(255, 255, 255, 0.18)";
  const launcherLabel = launcherText.trim();
  const isDarkMode = themeMode === "dark";
  const localizedCopy = getLocalizedCopy(language, botName);
  const welcomeMessages = buildWelcomeMessages(initialBotMessage, language, botName, consentRequired);

  const typingStyle = loadingStyle === "enterprise"
    ? { background: "#111827" }
    : loadingStyle === "pro"
      ? { background: "#ca8a04" }
      : isDarkMode
        ? { background: "#1f2937", border: "1px solid #374151" }
        : { background: "#ffffff", border: "1px solid #e2e8f0" };

  const typingDotClass = loadingStyle === "enterprise"
    ? "bg-white/80"
    : loadingStyle === "pro"
      ? "bg-amber-100"
      : isDarkMode
        ? "bg-slate-300"
        : "bg-slate-400";

  const LauncherIcon = launcherIcon === "none"
    ? null
    : launcherIcon === "sparkles"
      ? Sparkles
      : launcherIcon === "message"
        ? MessageSquare
        : MessageCircle;

  const sampleMessages = consentRequired
    ? welcomeMessages.map((message) => ({ role: "assistant" as const, text: message }))
    : [
        ...welcomeMessages.map((message) => ({ role: "assistant" as const, text: message })),
        { role: "user" as const, text: localizedCopy.sampleUserMessage },
        { role: "assistant" as const, text: localizedCopy.sampleAssistantMessage },
      ];

  return (
    <div className="overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-slate-100 backdrop-blur">
        <div>
          <p className="font-semibold tracking-tight">Website Preview</p>
          <p className="text-xs text-slate-300">Floating embed with live configuration</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-medium text-slate-200">
          {position === "bottom-left" ? "Bottom left" : "Bottom right"}
        </div>
      </div>

      <div className="relative min-h-[420px] overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.16),_transparent_42%),linear-gradient(180deg,_rgba(255,255,255,0.08),_rgba(255,255,255,0.02))] p-4 sm:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute left-10 top-10 h-24 w-24 rounded-full bg-white/20 blur-2xl" />
          <div className="absolute right-12 top-16 h-32 w-32 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute bottom-10 left-1/4 h-28 w-28 rounded-full bg-indigo-300/20 blur-2xl" />
        </div>

        <div
          className={cn(
            "relative mx-auto flex h-full max-w-[460px] flex-col overflow-hidden rounded-[30px] border shadow-[0_24px_60px_rgba(15,23,42,0.22)] backdrop-blur",
            isDarkMode ? "border-slate-700/80 bg-slate-900/95" : "border-slate-200/10 bg-white/95",
          )}
        >
          <div
            className="flex items-center justify-between px-4 py-3 text-white"
            style={{ background: `linear-gradient(135deg, ${themeColor}, color-mix(in srgb, ${themeColor} 72%, #ffffff 28%))` }}
          >
            <div>
              <p className="text-base font-semibold tracking-tight">{botName}</p>
            </div>
            <button type="button" className="rounded-full border border-white/15 bg-white/15 px-3 py-1 text-xs font-semibold text-white/90">
              X
            </button>
          </div>

          <div className={cn("flex flex-1 flex-col p-4", isDarkMode ? "bg-gradient-to-b from-slate-900 to-slate-950" : "bg-gradient-to-b from-slate-50 to-white")}>
            <div className="space-y-3">
              {sampleMessages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
                      message.role === "user" ? "rounded-br-sm text-white" : isDarkMode ? "rounded-bl-sm text-slate-200" : "rounded-bl-sm text-slate-700",
                    )}
                    style={{
                      background: message.role === "user" ? themeColor : isDarkMode ? "#334155" : "#e5e7eb",
                      color: message.role === "user" ? textTone : undefined,
                      boxShadow: message.role === "user" ? `0 14px 30px ${accentTone}` : undefined,
                    }}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex-1" />

            {consentRequired ? null : (
              <div className="mt-3 flex justify-start">
                <div className="rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm" style={typingStyle}>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 animate-pulse rounded-full", typingDotClass)} />
                    <span className={cn("h-2 w-2 animate-pulse rounded-full [animation-delay:120ms]", typingDotClass)} />
                    <span className={cn("h-2 w-2 animate-pulse rounded-full [animation-delay:240ms]", typingDotClass)} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {consentRequired ? (
            <div className={cn("border-t px-4 py-4", isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white")}>
              <p className={cn("text-sm leading-7", isDarkMode ? "text-slate-300" : "text-slate-600")}>
                {localizedCopy.consentLead}
                {privacyPolicyUrl.trim() ? (
                  <a
                    href={privacyPolicyUrl}
                    className="font-semibold underline underline-offset-4"
                    style={{ color: themeColor }}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {localizedCopy.consentLinkLabel}
                  </a>
                ) : (
                  <span className="font-semibold" style={{ color: themeColor }}>
                    {localizedCopy.consentLinkLabel}
                  </span>
                )}
                {localizedCopy.consentTail}
              </p>

              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  className="rounded-full px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_30px_rgba(15,23,42,0.22)]"
                  style={{ background: themeColor }}
                >
                  {localizedCopy.consentButtonLabel}
                </button>
              </div>
            </div>
          ) : (
            <div className={cn("border-t p-3", isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white")}>
              <div className={cn("flex items-center gap-2 rounded-2xl border px-3 py-2.5", isDarkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50")}>
                {microphoneEnabled ? (
                  <button
                    type="button"
                    className={cn("flex h-9 w-9 items-center justify-center rounded-xl border text-white", isDarkMode ? "border-slate-600" : "border-transparent")}
                    style={{ background: themeColor }}
                    aria-label="Microphone enabled"
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                ) : null}
                <span className={cn("text-xs font-medium uppercase tracking-[0.18em]", isDarkMode ? "text-slate-400" : "text-slate-400")}>{localizedCopy.inputPlaceholder}</span>
                <div className="ml-auto rounded-xl px-3 py-2 text-xs font-semibold text-white" style={{ background: themeColor }}>
                  {localizedCopy.sendLabel}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={cn("absolute bottom-4 flex items-center gap-3", position === "bottom-left" ? "left-4" : "right-4")}>
          <button
            type="button"
            className={cn(
              "flex h-14 items-center justify-center gap-2 rounded-full text-sm font-semibold shadow-[0_18px_30px_rgba(15,23,42,0.28)]",
              launcherLabel ? "px-4" : "w-14",
            )}
            style={{ background: themeColor, color: textTone }}
          >
            {LauncherIcon ? <LauncherIcon className="h-5 w-5" /> : null}
            {launcherLabel ? <span className="max-w-[120px] truncate">{launcherLabel}</span> : null}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-slate-100 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Theme</p>
          <p className="mt-1 text-sm font-semibold">{themeMode === "dark" ? "Dark" : "Light"} · {themeColor}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-slate-100 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Language</p>
          <p className="mt-1 text-sm font-semibold">{language}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-slate-100 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Position</p>
          <p className="mt-1 text-sm font-semibold">{position === "bottom-left" ? "Left" : "Right"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-slate-100 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Session Limit</p>
          <p className="mt-1 text-sm font-semibold">{Math.min(20, Math.max(1, maxSessionQuestions))} questions</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-slate-100 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Microphone</p>
          <p className="mt-1 text-sm font-semibold">{microphoneEnabled ? "Enabled" : "Disabled"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-slate-100 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Consent Gate</p>
          <p className="mt-1 text-sm font-semibold">{consentRequired ? "Enabled" : "Disabled"}</p>
        </div>
      </div>
    </div>
  );
}
