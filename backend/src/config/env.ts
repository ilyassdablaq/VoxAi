import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "backend/.env"),
  path.resolve(__dirname, "../../.env"),
];

const resolvedEnvPath = envCandidates.find((candidate) => fs.existsSync(candidate));
if (resolvedEnvPath) {
  dotenv.config({ path: resolvedEnvPath });
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default("0.0.0.0"),
  APP_ORIGIN: z.string().url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_MODEL_FREE: z.string().optional(),
  OPENAI_MODEL_PRO: z.string().optional(),
  OPENAI_MODEL_ENTERPRISE: z.string().optional(),
  OPENAI_FALLBACK_MODEL: z.string().optional(),
  DEEPGRAM_API_KEY: z.string().optional(),
  DEEPGRAM_MODEL: z.string().default("nova-2"),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().optional(),
  ELEVENLABS_MODEL: z.string().default("eleven_turbo_v2_5"),
  STT_PROVIDER: z.enum(["mock", "deepgram"]).default("deepgram"),
  LLM_PROVIDER: z.enum(["mock", "openai"]).default("openai"),
  TTS_PROVIDER: z.enum(["mock", "elevenlabs"]).default("elevenlabs"),
  DEFAULT_VOICE_LANGUAGE: z.string().default("en"),
  DEFAULT_AUDIO_SAMPLE_RATE: z.coerce.number().int().positive().default(16000),
  DEFAULT_AUDIO_CHANNELS: z.coerce.number().int().positive().default(1),
  DEFAULT_AUDIO_BYTES_PER_SAMPLE: z.coerce.number().int().positive().default(2),
  SENTRY_DSN: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_SUCCESS_URL: z.string().optional(),
  STRIPE_CANCEL_URL: z.string().optional(),
  STRIPE_PRICE_ID_PRO: z.string().optional(),
  STRIPE_PRICE_ID_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_ID_PRO_YEARLY: z.string().optional(),
  STRIPE_PRICE_ID_ENTERPRISE: z.string().optional(),
  STRIPE_PRICE_ID_ENTERPRISE_MONTHLY: z.string().optional(),
  STRIPE_PRICE_ID_ENTERPRISE_YEARLY: z.string().optional(),
  STRIPE_PAYMENT_LINK_PRO: z.string().optional(),
  STRIPE_PAYMENT_LINK_PRO_MONTHLY: z.string().optional(),
  STRIPE_PAYMENT_LINK_PRO_YEARLY: z.string().optional(),
  STRIPE_PAYMENT_LINK_ENTERPRISE: z.string().optional(),
  STRIPE_PAYMENT_LINK_ENTERPRISE_MONTHLY: z.string().optional(),
  STRIPE_PAYMENT_LINK_ENTERPRISE_YEARLY: z.string().optional(),
  STRIPE_PAYMENT_LINK_DEFAULT: z.string().optional(),
  STRIPE_ENABLE_PAYPAL: z.coerce.boolean().default(false),
  STRIPE_ENABLE_SEPA_DEBIT: z.coerce.boolean().default(false),
  STRIPE_ENABLE_WALLETS: z.coerce.boolean().default(true),
  RESEND_API_KEY: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_TEST_TO: z.string().email().optional(),
  RESET_PASSWORD_PATH: z.string().default("/reset-password"),
  CONTACT_RECEIVER_EMAIL: z.string().email().optional(),
  ADMIN_IP_ALLOWLIST: z.string().optional(),
  QUEUE_WORKERS_ENABLED: z.coerce.boolean().optional(),
  DATABASE_REPLICA_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

if (parsed.data.NODE_ENV !== "test") {
  const missingEmailVars: string[] = [];

  if (!parsed.data.RESEND_API_KEY) {
    missingEmailVars.push("RESEND_API_KEY");
  }

  if (!parsed.data.EMAIL_FROM) {
    missingEmailVars.push("EMAIL_FROM");
  }

  if (missingEmailVars.length > 0) {
    throw new Error(
      `Invalid environment configuration: missing required email variables: ${missingEmailVars.join(", ")}`,
    );
  }
}

export const env = parsed.data;
