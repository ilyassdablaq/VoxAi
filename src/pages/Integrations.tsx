import { Component, ErrorInfo, ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Loader2, Save } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { integrationService } from "@/services/integration.service";
import { API_BASE } from "@/lib/api-config";
import { ChatWidgetPreview } from "@/components/integrations/ChatWidgetPreview";

const THEME_PRESETS = [
  { label: "Indigo", value: "#5A67D8" },
  { label: "Ocean", value: "#0EA5E9" },
  { label: "Emerald", value: "#10B981" },
  { label: "Rose", value: "#F43F5E" },
  { label: "Amber", value: "#F59E0B" },
  { label: "Slate", value: "#334155" },
];

const LAUNCHER_ICON_OPTIONS: Array<{ label: string; value: "chat" | "message" | "sparkles" | "none" }> = [
  { label: "Chat bubble", value: "chat" },
  { label: "Message", value: "message" },
  { label: "Sparkles", value: "sparkles" },
  { label: "No icon", value: "none" },
];

const HEX_COLOR_REGEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const DEFAULT_INITIAL_BOT_MESSAGE = "Hi. Send me a message and I will reply here.";
const DEFAULT_MAX_SESSION_QUESTIONS = 3;

function toSafeHexColor(value?: string | null, fallback = "#5A67D8") {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return HEX_COLOR_REGEX.test(trimmed) ? trimmed : fallback;
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

class IntegrationPreviewBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Integration preview crashed:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>Preview unavailable</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            The preview failed to render, but your integration settings and embed snippet are still available.
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default function Integrations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { subscription } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["integration-settings"],
    queryFn: () => integrationService.getSettings(),
  });

  const [botName, setBotName] = useState("");
  const [themeColor, setThemeColor] = useState("#5A67D8");
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");
  const [position, setPosition] = useState<"bottom-right" | "bottom-left">("bottom-right");
  const [language, setLanguage] = useState("en");
  const [launcherText, setLauncherText] = useState("");
  const [launcherIcon, setLauncherIcon] = useState<"chat" | "message" | "sparkles" | "none">("chat");
  const [initialBotMessage, setInitialBotMessage] = useState(DEFAULT_INITIAL_BOT_MESSAGE);
  const [maxSessionQuestions, setMaxSessionQuestions] = useState(DEFAULT_MAX_SESSION_QUESTIONS);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);

  const loadingStyle = useMemo(() => {
    if (subscription?.effectivePlan === "ENTERPRISE") {
      return "enterprise" as const;
    }

    if (subscription?.effectivePlan === "PRO") {
      return "pro" as const;
    }

    return "free" as const;
  }, [subscription?.effectivePlan]);

  useEffect(() => {
    if (!data) {
      return;
    }

    setBotName(data.botName ?? "");
    setThemeColor(toSafeHexColor(data.themeColor));
    setThemeMode((previous) =>
      data.themeMode === "dark" || data.themeMode === "light"
        ? data.themeMode
        : previous,
    );
    setPosition(data.position);
    setLanguage(data.language);
    setLauncherText((previous) => (typeof data.launcherText === "string" ? data.launcherText.trim() : previous));
    setLauncherIcon((previous) => data.launcherIcon || previous || "chat");
    setInitialBotMessage(data.initialBotMessage?.trim() || DEFAULT_INITIAL_BOT_MESSAGE);
    setMaxSessionQuestions(Number.isFinite(data.maxSessionQuestions) ? Math.min(20, Math.max(1, data.maxSessionQuestions)) : DEFAULT_MAX_SESSION_QUESTIONS);
    setMicrophoneEnabled(Boolean(data.microphoneEnabled));
  }, [data]);

  const effectiveData = useMemo(() => {
    const nextBotName = botName.trim();
    const nextTheme = toSafeHexColor(themeColor || data?.themeColor || "#5A67D8");
    const nextLauncherText = launcherText.trim();
    const nextLauncherIcon = launcherIcon || data?.launcherIcon || "chat";
    const nextInitialBotMessage = initialBotMessage.trim() || data?.initialBotMessage || DEFAULT_INITIAL_BOT_MESSAGE;
    const nextMaxSessionQuestions = Math.min(20, Math.max(1, Number.isFinite(maxSessionQuestions) ? maxSessionQuestions : data?.maxSessionQuestions || DEFAULT_MAX_SESSION_QUESTIONS));

    return data
      ? {
          ...data,
          botName: nextBotName,
          themeColor: nextTheme,
          themeMode,
          position,
          language,
          launcherText: nextLauncherText,
          launcherIcon: nextLauncherIcon,
          initialBotMessage: nextInitialBotMessage,
          maxSessionQuestions: nextMaxSessionQuestions,
          microphoneEnabled,
        }
      : null;
  }, [botName, data, initialBotMessage, language, launcherIcon, launcherText, maxSessionQuestions, microphoneEnabled, position, themeColor, themeMode]);

  const selectedThemePreset = useMemo(() => {
    const normalized = (themeColor || data?.themeColor || "").toLowerCase();
    return THEME_PRESETS.find((preset) => preset.value.toLowerCase() === normalized)?.value ?? "custom";
  }, [data?.themeColor, themeColor]);

  const canSave = botName.trim().length > 0;

  const saveMutation = useMutation({
    mutationFn: () =>
      integrationService.updateSettings({
        botName: botName.trim(),
        themeColor: toSafeHexColor(themeColor || data?.themeColor || "#5A67D8"),
        themeMode,
        position,
        language,
        launcherText: launcherText.trim(),
        launcherIcon: launcherIcon || data?.launcherIcon || "chat",
        initialBotMessage: initialBotMessage.trim() || data?.initialBotMessage || DEFAULT_INITIAL_BOT_MESSAGE,
        maxSessionQuestions: Math.min(20, Math.max(1, maxSessionQuestions)),
        microphoneEnabled,
      }),
    onSuccess: (updated) => {
      const nextInitialBotMessage = initialBotMessage.trim() || DEFAULT_INITIAL_BOT_MESSAGE;
      const nextMaxSessionQuestions = Math.min(20, Math.max(1, maxSessionQuestions));

      const normalized = {
        ...updated,
        initialBotMessage: updated.initialBotMessage?.trim() || nextInitialBotMessage,
        maxSessionQuestions: Number.isFinite(updated.maxSessionQuestions)
          ? Math.min(20, Math.max(1, updated.maxSessionQuestions))
          : nextMaxSessionQuestions,
        microphoneEnabled: Boolean(updated.microphoneEnabled),
      };

      void queryClient.setQueryData(["integration-settings"], normalized);
      setBotName(updated.botName ?? botName.trim());
      setThemeColor(updated.themeColor);
      setThemeMode(updated.themeMode ?? themeMode);
      setPosition(updated.position);
      setLanguage(updated.language);
      setLauncherText(updated.launcherText ?? launcherText.trim());
      setLauncherIcon(updated.launcherIcon ?? launcherIcon ?? "chat");
      setInitialBotMessage(normalized.initialBotMessage);
      setMaxSessionQuestions(normalized.maxSessionQuestions);
      setMicrophoneEnabled(normalized.microphoneEnabled);
      toast({ title: "Saved", description: "Integration settings updated." });
    },
    onError: (error) => {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unable to save settings",
        variant: "destructive",
      });
    },
  });

  const regenerateKeyMutation = useMutation({
    mutationFn: () => integrationService.regenerateKey(),
    onSuccess: (updated) => {
      void queryClient.setQueryData(["integration-settings"], updated);
      toast({ title: "Embed key rotated", description: "Update your website snippet with the new key." });
    },
    onError: (error) => {
      toast({
        title: "Rotation failed",
        description: error instanceof Error ? error.message : "Unable to regenerate key",
        variant: "destructive",
      });
    },
  });

  const scriptSnippet = useMemo(() => {
    if (!effectiveData) {
      return "";
    }

    const scriptHost = typeof window !== "undefined" ? window.location.origin : "https://yourapp.com";

    return `<script src="${scriptHost}/chatbot.js" data-embed-key="${escapeHtmlAttribute(effectiveData.embedKey)}" data-api-base="${escapeHtmlAttribute(API_BASE)}" data-theme="${escapeHtmlAttribute(effectiveData.themeColor)}" data-theme-mode="${escapeHtmlAttribute(effectiveData.themeMode)}" data-position="${escapeHtmlAttribute(effectiveData.position)}" data-language="${escapeHtmlAttribute(effectiveData.language)}" data-bot-name="${escapeHtmlAttribute(effectiveData.botName)}" data-launcher-text="${escapeHtmlAttribute(effectiveData.launcherText)}" data-launcher-icon="${escapeHtmlAttribute(effectiveData.launcherIcon)}" data-initial-message="${escapeHtmlAttribute(effectiveData.initialBotMessage || DEFAULT_INITIAL_BOT_MESSAGE)}" data-max-session-questions="${effectiveData.maxSessionQuestions}" data-microphone-enabled="${String(effectiveData.microphoneEnabled)}" data-loading-style="${loadingStyle}"><\/script>`;
  }, [effectiveData, loadingStyle]);

  const copySnippet = async () => {
    await navigator.clipboard.writeText(scriptSnippet);
    toast({ title: "Copied", description: "Embed snippet copied to clipboard." });
  };

  if (isLoading || !data) {
    return (
      <DashboardShell title="Integrations" description="Install your chatbot on any website using an embeddable widget.">
        <Card><CardContent className="py-8">Loading integration settings...</CardContent></Card>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Integrations" description="Install your chatbot on any website using an embeddable widget.">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>Widget Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Bot Name</label>
              <Input
                value={botName}
                onChange={(event) => setBotName(event.target.value)}
                placeholder="z. B. VoxFlow Concierge"
              />
              {botName.trim().length === 0 ? (
                <p className="text-xs text-destructive">Bot name is required.</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Theme Color</label>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <select
                    className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
                    value={selectedThemePreset}
                    onChange={(event) => {
                      const next = event.target.value;
                      if (next !== "custom") {
                        setThemeColor(next);
                      }
                    }}
                  >
                    {THEME_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                    <option value="custom">Custom</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={toSafeHexColor(themeColor || data.themeColor)}
                      onChange={(event) => setThemeColor(event.target.value)}
                      className="h-11 w-14 cursor-pointer p-1"
                      aria-label="Select widget color"
                    />
                    <span className="min-w-[78px] text-xs font-medium text-muted-foreground">
                      {toSafeHexColor(themeColor || data.themeColor).toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Theme Mode</label>
                <select
                  className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={themeMode}
                  onChange={(event) => setThemeMode(event.target.value as "light" | "dark")}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Position</label>
                <select
                  className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={position || data.position}
                  onChange={(event) => setPosition(event.target.value as "bottom-right" | "bottom-left")}
                >
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">First Bot Message</label>
              <Textarea
                value={initialBotMessage}
                onChange={(event) => setInitialBotMessage(event.target.value.slice(0, 400))}
                rows={3}
                placeholder={DEFAULT_INITIAL_BOT_MESSAGE}
              />
              <p className="text-xs text-muted-foreground">This message is shown when the chat opens before the user sends anything.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Max Questions Per Session</label>
              <Input
                type="number"
                min={1}
                max={20}
                value={maxSessionQuestions}
                onChange={(event) => {
                  const parsed = Number.parseInt(event.target.value, 10);
                  if (Number.isNaN(parsed)) {
                    setMaxSessionQuestions(DEFAULT_MAX_SESSION_QUESTIONS);
                    return;
                  }

                  setMaxSessionQuestions(Math.min(20, Math.max(1, parsed)));
                }}
              />
              <p className="text-xs text-muted-foreground">After this number of user questions, the widget closes the chat session and stores it in Conversations.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Language</label>
              <select
                className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={language || data.language}
                onChange={(event) => setLanguage(event.target.value)}
              >
                <option value="en">English</option>
                <option value="de">Deutsch</option>
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Launcher Text</label>
                <Input
                  value={launcherText}
                  onChange={(event) => setLauncherText(event.target.value.slice(0, 20))}
                  placeholder="Chat"
                />
                <p className="text-xs text-muted-foreground">Leave text short to keep the floating button compact.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Launcher Icon</label>
                <select
                  className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={launcherIcon}
                  onChange={(event) => setLauncherIcon(event.target.value as "chat" | "message" | "sparkles" | "none")}
                >
                  {LAUNCHER_ICON_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">If launcher text is empty, the icon is shown as the button content.</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Enable Microphone</label>
                <p className="text-xs text-muted-foreground">Show voice input in the chatbot for browsers that support it.</p>
              </div>
              <Switch checked={microphoneEnabled} onCheckedChange={setMicrophoneEnabled} aria-label="Enable microphone" />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !canSave} className="min-h-11">
                {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Settings
              </Button>
              <Button
                variant="outline"
                onClick={() => regenerateKeyMutation.mutate()}
                disabled={regenerateKeyMutation.isPending}
                className="min-h-11"
              >
                {regenerateKeyMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Regenerate Key
              </Button>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
              Changes here update both the snippet and the preview, so you can validate the look before copying the embed code.
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <IntegrationPreviewBoundary>
            <ChatWidgetPreview
              botName={effectiveData?.botName ?? data.botName}
              themeColor={effectiveData?.themeColor ?? data.themeColor}
              position={effectiveData?.position ?? data.position}
              language={effectiveData?.language ?? data.language}
              launcherText={effectiveData?.launcherText ?? data.launcherText ?? "Chat"}
              launcherIcon={effectiveData?.launcherIcon ?? data.launcherIcon ?? "chat"}
              initialBotMessage={effectiveData?.initialBotMessage ?? data.initialBotMessage ?? DEFAULT_INITIAL_BOT_MESSAGE}
              maxSessionQuestions={effectiveData?.maxSessionQuestions ?? data.maxSessionQuestions ?? DEFAULT_MAX_SESSION_QUESTIONS}
              microphoneEnabled={effectiveData?.microphoneEnabled ?? data.microphoneEnabled ?? false}
              themeMode={effectiveData?.themeMode ?? data.themeMode ?? "light"}
              loadingStyle={loadingStyle}
            />
          </IntegrationPreviewBoundary>

          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle>Embed Script</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Paste this script before the closing `&lt;/body&gt;` tag on your website.</p>
              <Textarea value={scriptSnippet} readOnly rows={8} className="font-mono text-xs" />
              <div className="flex gap-2">
                <Button onClick={copySnippet} className="min-h-11">
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Snippet
                </Button>
              </div>
              <div className="rounded-2xl border border-border p-3 text-sm text-muted-foreground">
                1. Copy the script above.
                <br />2. Paste it into your website HTML.
                <br />3. Publish your site and the chatbot appears as a floating button.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
