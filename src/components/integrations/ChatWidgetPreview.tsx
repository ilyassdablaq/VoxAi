import { cn } from "@/lib/utils";

interface ChatWidgetPreviewProps {
  botName: string;
  themeColor: string;
  position: "bottom-right" | "bottom-left";
  language: string;
}

const sampleMessages = [
  { role: "assistant" as const, text: "Hi. Send me a message and I will reply here." },
  { role: "user" as const, text: "Hallo" },
  { role: "assistant" as const, text: "Natürlich. Ich kann dir bei Fragen zu deinem Produkt oder deiner Website helfen." },
  { role: "user" as const, text: "why" },
  { role: "assistant" as const, text: "Because the widget now mirrors the embedded version and shows a live preview of the response flow." },
];

function isLightColor(color: string) {
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

export function ChatWidgetPreview({ botName, themeColor, position, language }: ChatWidgetPreviewProps) {
  const textTone = isLightColor(themeColor) ? "#0f172a" : "#ffffff";
  const accentTone = isLightColor(themeColor) ? "rgba(15, 23, 42, 0.18)" : "rgba(255, 255, 255, 0.18)";

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

        <div className="relative mx-auto flex h-full max-w-[460px] flex-col overflow-hidden rounded-[30px] border border-slate-200/10 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.22)] backdrop-blur">
          <div className="flex items-center justify-between bg-[linear-gradient(135deg,theme(colors.indigo.600),theme(colors.indigo.500))] px-4 py-3 text-white">
            <div>
              <p className="text-base font-semibold tracking-tight">{botName}</p>
            </div>
            <div className="rounded-full border border-white/15 bg-white/15 px-3 py-1 text-[11px] font-semibold text-white/90">
              Online
            </div>
          </div>

          <div className="flex-1 space-y-3 bg-gradient-to-b from-slate-50 to-white p-4">
            {sampleMessages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
                    message.role === "user" ? "rounded-br-sm text-white" : "rounded-bl-sm text-slate-700",
                  )}
                  style={{
                    background: message.role === "user" ? themeColor : "#e5e7eb",
                    color: message.role === "user" ? textTone : undefined,
                    boxShadow: message.role === "user" ? `0 14px 30px ${accentTone}` : undefined,
                  }}
                >
                  {message.text}
                </div>
              </div>
            ))}

            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-100 px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400 [animation-delay:120ms]" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400 [animation-delay:240ms]" />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Type your message...</span>
              <div className="ml-auto rounded-xl px-3 py-2 text-xs font-semibold text-white" style={{ background: themeColor }}>
                Send
              </div>
            </div>
          </div>
        </div>

        <div className={cn("absolute bottom-4 flex items-center gap-3", position === "bottom-left" ? "left-4" : "right-4")}>
          <button
            type="button"
            className="flex h-14 w-14 items-center justify-center rounded-full text-sm font-semibold shadow-[0_18px_30px_rgba(15,23,42,0.28)]"
            style={{ background: themeColor, color: textTone }}
          >
            Chat
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-slate-100 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Theme</p>
          <p className="mt-1 text-sm font-semibold">{themeColor}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-slate-100 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Language</p>
          <p className="mt-1 text-sm font-semibold">{language}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-slate-100 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Position</p>
          <p className="mt-1 text-sm font-semibold">{position === "bottom-left" ? "Left" : "Right"}</p>
        </div>
      </div>
    </div>
  );
}
