import { VoiceRepository } from "./voice.repository.js";
import { VoiceSettingsInput } from "./voice.schemas.js";

export class VoiceService {
  constructor(private readonly repository: VoiceRepository) {}

  async getSettings(userId: string) {
    return this.repository.getOrCreate(userId);
  }

  async updateSettings(userId: string, payload: VoiceSettingsInput) {
    return this.repository.update(userId, payload);
  }

  getAvailableVoices() {
    return [
      {
        id: "EXAVITQu4vr4xnSDxMaL",
        label: "Bella",
        provider: "elevenlabs",
      },
      {
        id: "pNInz6obpgDQGcFmaJgB",
        label: "Adam",
        provider: "elevenlabs",
      },
      {
        id: "onwK4e9ZLuTAKqWW03F9",
        label: "Daniel",
        provider: "elevenlabs",
      },
      {
        id: "mock_default",
        label: "Mock Voice",
        provider: "mock",
      },
    ];
  }
}
