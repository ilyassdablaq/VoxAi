import { randomBytes } from "node:crypto";
import { prisma } from "../../infra/database/prisma.js";

type IntegrationSettingsRecord = {
  userId: string;
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
  embedKey: string;
  updatedAt: Date;
};

function createEmbedKey() {
  return `emb_${randomBytes(24).toString("hex")}`;
}

export class IntegrationRepository {
  private initialized = false;

  private async ensureTable() {
    if (this.initialized) {
      return;
    }

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS integration_settings (
        user_id TEXT PRIMARY KEY,
        bot_name TEXT NOT NULL,
        theme_color TEXT NOT NULL,
        theme_mode TEXT NOT NULL DEFAULT 'light',
        position TEXT NOT NULL,
        language TEXT NOT NULL,
        launcher_text TEXT NOT NULL DEFAULT 'Chat',
        launcher_icon TEXT NOT NULL DEFAULT 'chat',
        initial_bot_message TEXT NOT NULL DEFAULT 'Hi. Send me a message and I will reply here.',
        max_session_questions INTEGER NOT NULL DEFAULT 3,
        microphone_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        consent_required BOOLEAN NOT NULL DEFAULT TRUE,
        privacy_policy_url TEXT NOT NULL DEFAULT '',
        embed_key TEXT UNIQUE NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE integration_settings
      ADD COLUMN IF NOT EXISTS launcher_text TEXT NOT NULL DEFAULT 'Chat'
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE integration_settings
      ADD COLUMN IF NOT EXISTS launcher_icon TEXT NOT NULL DEFAULT 'chat'
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE integration_settings
      ADD COLUMN IF NOT EXISTS theme_mode TEXT NOT NULL DEFAULT 'light'
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE integration_settings
      ADD COLUMN IF NOT EXISTS initial_bot_message TEXT NOT NULL DEFAULT 'Hi. Send me a message and I will reply here.'
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE integration_settings
      ADD COLUMN IF NOT EXISTS max_session_questions INTEGER NOT NULL DEFAULT 3
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE integration_settings
      ADD COLUMN IF NOT EXISTS microphone_enabled BOOLEAN NOT NULL DEFAULT FALSE
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE integration_settings
      ADD COLUMN IF NOT EXISTS consent_required BOOLEAN NOT NULL DEFAULT TRUE
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE integration_settings
      ADD COLUMN IF NOT EXISTS privacy_policy_url TEXT NOT NULL DEFAULT ''
    `);

    this.initialized = true;
  }

  private mapRecord(row: {
    user_id: string;
    bot_name: string;
    theme_color: string;
    theme_mode: "light" | "dark";
    position: "bottom-right" | "bottom-left";
    language: string;
    launcher_text: string | null;
    launcher_icon: "chat" | "message" | "sparkles" | "none" | null;
    initial_bot_message: string | null;
    max_session_questions: number | null;
    microphone_enabled: boolean | null;
    consent_required: boolean | null;
    privacy_policy_url: string | null;
    embed_key: string;
    updated_at: Date;
  }): IntegrationSettingsRecord {
    return {
      userId: row.user_id,
      botName: row.bot_name,
      themeColor: row.theme_color,
      themeMode: row.theme_mode ?? "light",
      position: row.position,
      language: row.language,
      launcherText: row.launcher_text ?? "Chat",
      launcherIcon: row.launcher_icon ?? "chat",
      initialBotMessage: row.initial_bot_message ?? "Hi. Send me a message and I will reply here.",
      maxSessionQuestions: row.max_session_questions ?? 3,
      microphoneEnabled: row.microphone_enabled ?? false,
      consentRequired: row.consent_required ?? true,
      privacyPolicyUrl: row.privacy_policy_url ?? "",
      embedKey: row.embed_key,
      updatedAt: row.updated_at,
    };
  }

  async getOrCreateByUserId(userId: string) {
    await this.ensureTable();

    const existing = await prisma.$queryRawUnsafe<
      Array<{
        user_id: string;
        bot_name: string;
        theme_color: string;
        theme_mode: "light" | "dark";
        position: "bottom-right" | "bottom-left";
        language: string;
        launcher_text: string | null;
        launcher_icon: "chat" | "message" | "sparkles" | "none" | null;
        initial_bot_message: string | null;
        max_session_questions: number | null;
        microphone_enabled: boolean | null;
        consent_required: boolean | null;
        privacy_policy_url: string | null;
        embed_key: string;
        updated_at: Date;
      }>
    >(
      `
        SELECT user_id, bot_name, theme_color, theme_mode, position, language, launcher_text, launcher_icon, initial_bot_message, max_session_questions, microphone_enabled, consent_required, privacy_policy_url, embed_key, updated_at
        FROM integration_settings
        WHERE user_id = $1
      `,
      userId,
    );

    if (existing.length > 0) {
      return this.mapRecord(existing[0]);
    }

    const embedKey = createEmbedKey();
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO integration_settings (user_id, bot_name, theme_color, theme_mode, position, language, launcher_text, launcher_icon, initial_bot_message, max_session_questions, microphone_enabled, consent_required, privacy_policy_url, embed_key, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      `,
      userId,
      "Chatbot",
      "#5A67D8",
      "light",
      "bottom-right",
      "en",
      "Chat",
      "chat",
      "Hi. Send me a message and I will reply here.",
      3,
      false,
      true,
      "",
      embedKey,
    );

    return {
      userId,
      botName: "Chatbot",
      themeColor: "#5A67D8",
      themeMode: "light",
      position: "bottom-right",
      language: "en",
      launcherText: "Chat",
      launcherIcon: "chat",
      initialBotMessage: "Hi. Send me a message and I will reply here.",
      maxSessionQuestions: 3,
      microphoneEnabled: false,
      consentRequired: true,
      privacyPolicyUrl: "",
      embedKey,
      updatedAt: new Date(),
    } as IntegrationSettingsRecord;
  }

  async updateSettings(userId: string, payload: {
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
  }) {
    await this.ensureTable();

    await this.getOrCreateByUserId(userId);

    const updatedRows = await prisma.$queryRawUnsafe<
      Array<{
        user_id: string;
        bot_name: string;
        theme_color: string;
        theme_mode: "light" | "dark";
        position: "bottom-right" | "bottom-left";
        language: string;
        launcher_text: string | null;
        launcher_icon: "chat" | "message" | "sparkles" | "none" | null;
        initial_bot_message: string | null;
        max_session_questions: number | null;
        microphone_enabled: boolean | null;
        consent_required: boolean | null;
        privacy_policy_url: string | null;
        embed_key: string;
        updated_at: Date;
      }>
    >(
      `
        UPDATE integration_settings
        SET bot_name = $2,
            theme_color = $3,
            theme_mode = $4,
            position = $5,
            language = $6,
            launcher_text = $7,
            launcher_icon = $8,
            initial_bot_message = $9,
            max_session_questions = $10,
            microphone_enabled = $11,
            consent_required = $12,
            privacy_policy_url = $13,
            updated_at = NOW()
        WHERE user_id = $1
          RETURNING user_id, bot_name, theme_color, theme_mode, position, language, launcher_text, launcher_icon, initial_bot_message, max_session_questions, microphone_enabled, consent_required, privacy_policy_url, embed_key, updated_at
      `,
      userId,
      payload.botName,
      payload.themeColor,
      payload.themeMode,
      payload.position,
      payload.language,
      payload.launcherText,
      payload.launcherIcon,
      payload.initialBotMessage,
      payload.maxSessionQuestions,
      payload.microphoneEnabled,
      payload.consentRequired,
      payload.privacyPolicyUrl,
    );

    if (updatedRows.length === 0) {
      return this.getOrCreateByUserId(userId);
    }

    return this.mapRecord(updatedRows[0]);
  }

  async regenerateEmbedKey(userId: string) {
    await this.ensureTable();

    await this.getOrCreateByUserId(userId);
    const embedKey = createEmbedKey();

    await prisma.$executeRawUnsafe(
      `
        UPDATE integration_settings
        SET embed_key = $2,
            updated_at = NOW()
        WHERE user_id = $1
      `,
      userId,
      embedKey,
    );

    return this.getOrCreateByUserId(userId);
  }

  async getByEmbedKey(embedKey: string) {
    await this.ensureTable();

    const rows = await prisma.$queryRawUnsafe<
      Array<{
        user_id: string;
        bot_name: string;
        theme_color: string;
        theme_mode: "light" | "dark";
        position: "bottom-right" | "bottom-left";
        language: string;
        launcher_text: string | null;
        launcher_icon: "chat" | "message" | "sparkles" | "none" | null;
        initial_bot_message: string | null;
        max_session_questions: number | null;
        microphone_enabled: boolean | null;
        consent_required: boolean | null;
        privacy_policy_url: string | null;
        embed_key: string;
        updated_at: Date;
      }>
    >(
      `
        SELECT user_id, bot_name, theme_color, theme_mode, position, language, launcher_text, launcher_icon, initial_bot_message, max_session_questions, microphone_enabled, consent_required, privacy_policy_url, embed_key, updated_at
        FROM integration_settings
        WHERE embed_key = $1
      `,
      embedKey,
    );

    if (rows.length === 0) {
      return null;
    }

    return this.mapRecord(rows[0]);
  }
}
