import { env } from "../../config/env.js";
import { prisma } from "../../infra/database/prisma.js";
import { VoiceSettingsInput } from "./voice.schemas.js";

export type VoiceSettingsRecord = {
  userId: string;
  provider: "mock" | "elevenlabs";
  voiceId: string | null;
  speed: number;
  style: number;
  stability: number;
  updatedAt: Date;
};

const defaultSettings: Omit<VoiceSettingsRecord, "userId" | "updatedAt"> = {
  provider: env.TTS_PROVIDER,
  voiceId: env.ELEVENLABS_VOICE_ID ?? null,
  speed: 1,
  style: 0.5,
  stability: 0.5,
};

export class VoiceRepository {
  private initialized = false;

  private async ensureTable() {
    if (this.initialized) {
      return;
    }

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS voice_settings (
        user_id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        voice_id TEXT,
        speed DOUBLE PRECISION NOT NULL DEFAULT 1,
        style DOUBLE PRECISION NOT NULL DEFAULT 0.5,
        stability DOUBLE PRECISION NOT NULL DEFAULT 0.5,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    this.initialized = true;
  }

  async getOrCreate(userId: string): Promise<VoiceSettingsRecord> {
    await this.ensureTable();

    const rows = await prisma.$queryRawUnsafe<Array<{
      user_id: string;
      provider: "mock" | "elevenlabs";
      voice_id: string | null;
      speed: number;
      style: number;
      stability: number;
      updated_at: Date;
    }>>(
      `
      SELECT user_id, provider, voice_id, speed, style, stability, updated_at
      FROM voice_settings
      WHERE user_id = $1
      LIMIT 1
      `,
      userId,
    );

    const existing = rows[0];
    if (existing) {
      return {
        userId: existing.user_id,
        provider: existing.provider,
        voiceId: existing.voice_id,
        speed: existing.speed,
        style: existing.style,
        stability: existing.stability,
        updatedAt: existing.updated_at,
      };
    }

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO voice_settings (user_id, provider, voice_id, speed, style, stability, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `,
      userId,
      defaultSettings.provider,
      defaultSettings.voiceId,
      defaultSettings.speed,
      defaultSettings.style,
      defaultSettings.stability,
    );

    return {
      userId,
      ...defaultSettings,
      updatedAt: new Date(),
    };
  }

  async update(userId: string, payload: VoiceSettingsInput): Promise<VoiceSettingsRecord> {
    await this.ensureTable();
    await this.getOrCreate(userId);

    await prisma.$executeRawUnsafe(
      `
      UPDATE voice_settings
      SET provider = $2,
          voice_id = $3,
          speed = $4,
          style = $5,
          stability = $6,
          updated_at = NOW()
      WHERE user_id = $1
      `,
      userId,
      payload.provider,
      payload.voiceId ?? null,
      payload.speed,
      payload.style,
      payload.stability,
    );

    return this.getOrCreate(userId);
  }
}
