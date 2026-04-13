import { Component, ErrorInfo, ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Loader2, Save } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
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

const LAUNCHER_ICON_OPTIONS: Array<{ label: string; value: "chat" | "message" | "sparkles" }> = [
  { label: "Chat bubble", value: "chat" },
  { label: "Message", value: "message" },
  { label: "Sparkles", value: "sparkles" },
];

const HEX_COLOR_REGEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function toSafeHexColor(value?: string | null, fallback = "#5A67D8") {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return HEX_COLOR_REGEX.test(trimmed) ? trimmed : fallback;
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

  const { data, isLoading } = useQuery({
    queryKey: ["integration-settings"],
    queryFn: () => integrationService.getSettings(),
  });

  const [botName, setBotName] = useState("");
  const [themeColor, setThemeColor] = useState("#5A67D8");
  const [position, setPosition] = useState<"bottom-right" | "bottom-left">("bottom-right");
  const [language, setLanguage] = useState("en");
  const [launcherText, setLauncherText] = useState("Chat");
  const [launcherIcon, setLauncherIcon] = useState<"chat" | "message" | "sparkles">("chat");

  useEffect(() => {
    if (!data) {
      return;
    }

    setBotName(data.botName);
    setThemeColor(toSafeHexColor(data.themeColor));
    setPosition(data.position);
    setLanguage(data.language);
    setLauncherText((data.launcherText || "Chat").trim());
    setLauncherIcon(data.launcherIcon || "chat");
  }, [data]);

  const effectiveData = useMemo(() => {
    const nextBotName = (botName || data?.botName || "Chatbot").trim();
    const nextTheme = toSafeHexColor(themeColor || data?.themeColor || "#5A67D8");
    const nextLauncherText = (launcherText || data?.launcherText || "Chat").trim();
    const nextLauncherIcon = launcherIcon || data?.launcherIcon || "chat";

    return data
      ? {
          ...data,
          botName: nextBotName,
          themeColor: nextTheme,
          position,
          language,
          launcherText: nextLauncherText,
          launcherIcon: nextLauncherIcon,
        }
      : null;
  }, [botName, data, language, launcherIcon, launcherText, position, themeColor]);

  const selectedThemePreset = useMemo(() => {
    const normalized = (themeColor || data?.themeColor || "").toLowerCase();
    return THEME_PRESETS.find((preset) => preset.value.toLowerCase() === normalized)?.value ?? "custom";
  }, [data?.themeColor, themeColor]);

  const canSave = (botName || data?.botName || "").trim().length > 0;

  const saveMutation = useMutation({
    mutationFn: () =>
      integrationService.updateSettings({
        botName: (botName || data?.botName || "Chatbot").trim(),
        themeColor: toSafeHexColor(themeColor || data?.themeColor || "#5A67D8"),
        position,
        language,
        launcherText: (launcherText || data?.launcherText || "Chat").trim(),
        launcherIcon: launcherIcon || data?.launcherIcon || "chat",
      }),
    onSuccess: (updated) => {
      void queryClient.setQueryData(["integration-settings"], updated);
      setBotName(updated.botName);
      setThemeColor(updated.themeColor);
      setPosition(updated.position);
      setLanguage(updated.language);
      setLauncherText(updated.launcherText);
      setLauncherIcon(updated.launcherIcon);
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

    return `<script src="${scriptHost}/chatbot.js" data-embed-key="${effectiveData.embedKey}" data-api-base="${API_BASE}" data-theme="${effectiveData.themeColor}" data-position="${effectiveData.position}" data-language="${effectiveData.language}" data-bot-name="${effectiveData.botName}" data-launcher-text="${effectiveData.launcherText}" data-launcher-icon="${effectiveData.launcherIcon}"><\/script>`;
  }, [effectiveData]);

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
                value={botName || data.botName}
                onChange={(event) => setBotName(event.target.value)}
                placeholder="z. B. VoxFlow Concierge"
              />
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
                  onChange={(event) => setLauncherIcon(event.target.value as "chat" | "message" | "sparkles")}
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
