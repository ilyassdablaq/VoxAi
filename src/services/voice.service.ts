import { apiClient } from "@/lib/api-client";

export interface VoiceSettings {
  userId: string;
  provider: "mock" | "elevenlabs";
  voiceId: string | null;
  speed: number;
  style: number;
  stability: number;
  updatedAt: string;
}

export interface VoiceOption {
  id: string;
  label: string;
  provider: "mock" | "elevenlabs";
}

export const voiceService = {
  getSettings(): Promise<VoiceSettings> {
    return apiClient.get<VoiceSettings>("/api/voice/settings");
  },

  updateSettings(payload: {
    provider: "mock" | "elevenlabs";
    voiceId: string | null;
    speed: number;
    style: number;
    stability: number;
  }): Promise<VoiceSettings> {
    return apiClient.put<VoiceSettings>("/api/voice/settings", payload);
  },

  getVoiceOptions(): Promise<VoiceOption[]> {
    return apiClient.get<VoiceOption[]>("/api/voice/options");
  },
};
