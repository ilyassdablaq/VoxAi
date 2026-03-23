import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { voiceService } from "@/services/voice.service";

export default function VoiceSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const settingsQuery = useQuery({
    queryKey: ["voice-settings"],
    queryFn: () => voiceService.getSettings(),
  });

  const voicesQuery = useQuery({
    queryKey: ["voice-options"],
    queryFn: () => voiceService.getVoiceOptions(),
  });

  const [provider, setProvider] = useState<"mock" | "elevenlabs">("elevenlabs");
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);
  const [style, setStyle] = useState(0.5);
  const [stability, setStability] = useState(0.5);

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }

    setProvider(settingsQuery.data.provider);
    setVoiceId(settingsQuery.data.voiceId);
    setSpeed(settingsQuery.data.speed);
    setStyle(settingsQuery.data.style);
    setStability(settingsQuery.data.stability);
  }, [settingsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () =>
      voiceService.updateSettings({
        provider,
        voiceId,
        speed,
        style,
        stability,
      }),
    onSuccess: (updated) => {
      void queryClient.setQueryData(["voice-settings"], updated);
      toast({ title: "Voice settings saved", description: "TTS preferences are now active." });
    },
    onError: (error) => {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unable to save voice settings",
        variant: "destructive",
      });
    },
  });

  const availableVoices = (voicesQuery.data ?? []).filter((voice) => voice.provider === provider);

  return (
    <DashboardShell title="Text-to-Speech Controls" description="Select voice, speed, and style for generated speech responses.">
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Voice Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {settingsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading voice settings...</p> : null}

          <div className="space-y-2">
            <label className="text-sm">Provider</label>
            <select
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={provider}
              onChange={(event) => setProvider(event.target.value as "mock" | "elevenlabs")}
            >
              <option value="elevenlabs">ElevenLabs</option>
              <option value="mock">Mock (test mode)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm">Voice</label>
            <select
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={voiceId ?? ""}
              onChange={(event) => setVoiceId(event.target.value || null)}
            >
              {availableVoices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm">Speed: {speed.toFixed(2)}x</label>
            <input type="range" min={0.7} max={1.3} step={0.01} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="w-full" />
          </div>

          <div className="space-y-2">
            <label className="text-sm">Tone/Style: {style.toFixed(2)}</label>
            <input type="range" min={0} max={1} step={0.01} value={style} onChange={(event) => setStyle(Number(event.target.value))} className="w-full" />
          </div>

          <div className="space-y-2">
            <label className="text-sm">Stability: {stability.toFixed(2)}</label>
            <input type="range" min={0} max={1} step={0.01} value={stability} onChange={(event) => setStability(Number(event.target.value))} className="w-full" />
          </div>

          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Voice Settings
          </Button>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
