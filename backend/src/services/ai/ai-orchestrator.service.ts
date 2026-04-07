import { logger } from "../../config/logger.js";
import { PlanCheckService } from "../../common/services/plan-check.service.js";
import { env } from "../../config/env.js";
import { VoiceRepository } from "../../modules/voice/voice.repository.js";
import { RagService } from "../rag/rag.service.js";
import {
  ChatMessage,
  LlmRequestOptions,
  LlmGenerationResult,
  MockLlmProvider,
  ProviderSet,
  SttResult,
  TtsResult,
  TtsVoiceOptions,
  createProviders,
} from "./providers.js";
import {
  applyInputGuardrails,
  applyOutputGuardrails,
  buildGuardrailSystemDirectives,
  sanitizeContextSnippets,
} from "./guardrails.service.js";

const EMPTY_MP3_BASE64 = "SUQzAwAAAAAA";

function normalizeRole(role: "USER" | "ASSISTANT" | "SYSTEM"): ChatMessage["role"] {
  if (role === "ASSISTANT") {
    return "assistant";
  }

  if (role === "SYSTEM") {
    return "system";
  }

  return "user";
}

function buildLanguageInstructions(language: string): string {
  const normalized = language.toLowerCase();
  return `Respond primarily in ${normalized}. Match the user's language when detected and keep tone natural. Provide complete, useful answers (typically 3-6 sentences unless user asks for brevity).`;
}

function buildTemporalInstructions(): string {
  const now = new Date();
  const isoDate = now.toISOString().slice(0, 10);
  const isoTimestamp = now.toISOString();
  return [
    `Current date (ISO): ${isoDate}.`,
    `Current timestamp (UTC): ${isoTimestamp}.`,
    "When the user asks about today's date/time, use this runtime date context and do not guess.",
  ].join(" ");
}

export class AiOrchestratorService {
  private readonly providers: ProviderSet;
  private readonly voiceRepository: VoiceRepository;
  private readonly planCache = new Map<string, { planType: "FREE" | "PRO" | "ENTERPRISE"; expiresAt: number }>();
  private readonly planCheckService = new PlanCheckService();

  constructor(private readonly ragService: RagService) {
    this.providers = createProviders();
    this.voiceRepository = new VoiceRepository();
  }

  async processVoiceTurn(input: {
    userId: string;
    audioChunk: Buffer;
    language: string;
    syntheticEmbedding?: number[];
    history?: Array<{ role: "USER" | "ASSISTANT" | "SYSTEM"; content: string }>;
  }) {
    const sttResult = await this.transcribe(input.audioChunk, input.language);
    const safeTranscript = applyInputGuardrails(sttResult.text);

    const contexts = sanitizeContextSnippets(await this.ragService.retrieveContext(input.userId, safeTranscript, 3));
    const ragContext = `${buildGuardrailSystemDirectives()}\n\n${this.ragService.buildPrompt(safeTranscript, contexts)}`;
    const llmOptions = await this.resolveLlmOptions(input.userId);

    const llmMessages = input.history?.length
      ? input.history.map((message) => ({
          role: normalizeRole(message.role),
          content: message.content,
        }))
      : [
          {
            role: "user" as const,
            content: safeTranscript,
          },
        ];

    const llmResult = await this.generateText(
      `${ragContext}\n\n${buildLanguageInstructions(input.language)}\n\n${buildTemporalInstructions()}`,
      llmMessages,
      llmOptions,
    );
    const safeResponseText = applyOutputGuardrails(llmResult.text);

    const ttsResult = await this.speak(input.userId, safeResponseText, input.language);

    return {
      transcript: safeTranscript,
      responseText: safeResponseText,
      tokenCount: llmResult.usage.totalTokens,
      promptTokens: llmResult.usage.promptTokens,
      completionTokens: llmResult.usage.completionTokens,
      audioBuffer: ttsResult.audioBuffer,
      audioBase64: ttsResult.audioBuffer.toString("base64"),
      audioMimeType: ttsResult.mimeType,
      sttDurationSeconds: sttResult.durationSeconds,
      ttsDurationSeconds: ttsResult.durationSeconds,
      ragContextCount: contexts.length,
    };
  }

  async processTextTurn(input: {
    userId: string;
    text: string;
    language: string;
    syntheticEmbedding?: number[];
    history?: Array<{ role: "USER" | "ASSISTANT" | "SYSTEM"; content: string }>;
  }) {
    const safeText = applyInputGuardrails(input.text);
    const contexts = sanitizeContextSnippets(await this.ragService.retrieveContext(input.userId, safeText, 3));
    const ragContext = `${buildGuardrailSystemDirectives()}\n\n${this.ragService.buildPrompt(safeText, contexts)}`;
    const llmOptions = await this.resolveLlmOptions(input.userId);

    const llmMessages = input.history?.length
      ? input.history.map((message) => ({
          role: normalizeRole(message.role),
          content: message.content,
        }))
      : [
          {
            role: "user" as const,
            content: safeText,
          },
        ];

    const llmResult = await this.generateText(
      `${ragContext}\n\n${buildLanguageInstructions(input.language)}\n\n${buildTemporalInstructions()}`,
      llmMessages,
      llmOptions,
    );
    const safeResponseText = applyOutputGuardrails(llmResult.text);

    const ttsResult = await this.speak(input.userId, safeResponseText, input.language);

    return {
      responseText: safeResponseText,
      tokenCount: llmResult.usage.totalTokens,
      promptTokens: llmResult.usage.promptTokens,
      completionTokens: llmResult.usage.completionTokens,
      audioBuffer: ttsResult.audioBuffer,
      audioBase64: ttsResult.audioBuffer.toString("base64"),
      audioMimeType: ttsResult.mimeType,
      sttDurationSeconds: 0,
      ttsDurationSeconds: ttsResult.durationSeconds,
      ragContextCount: contexts.length,
    };
  }

  async streamTextTurn(
    input: {
      userId: string;
      text: string;
      language: string;
      syntheticEmbedding?: number[];
      history?: Array<{ role: "USER" | "ASSISTANT" | "SYSTEM"; content: string }>;
    },
    onToken: (token: string) => void,
  ) {
    const safeText = applyInputGuardrails(input.text);
    const contexts = sanitizeContextSnippets(await this.ragService.retrieveContext(input.userId, safeText, 3));
    const ragContext = `${buildGuardrailSystemDirectives()}\n\n${this.ragService.buildPrompt(safeText, contexts)}`;
    const llmOptions = await this.resolveLlmOptions(input.userId);

    const llmMessages = input.history?.length
      ? input.history.map((message) => ({
          role: normalizeRole(message.role),
          content: message.content,
        }))
      : [
          {
            role: "user" as const,
            content: safeText,
          },
        ];

    const llmResult = await this.streamGenerateText(
      `${ragContext}\n\n${buildLanguageInstructions(input.language)}\n\n${buildTemporalInstructions()}`,
      llmMessages,
      onToken,
      llmOptions,
    );
    const safeResponseText = applyOutputGuardrails(llmResult.text);

    const ttsResult = await this.speak(input.userId, safeResponseText, input.language);

    return {
      responseText: safeResponseText,
      tokenCount: llmResult.usage.totalTokens,
      promptTokens: llmResult.usage.promptTokens,
      completionTokens: llmResult.usage.completionTokens,
      audioBuffer: ttsResult.audioBuffer,
      audioBase64: ttsResult.audioBuffer.toString("base64"),
      audioMimeType: ttsResult.mimeType,
      sttDurationSeconds: 0,
      ttsDurationSeconds: ttsResult.durationSeconds,
      ragContextCount: contexts.length,
    };
  }

  private async transcribe(audio: Buffer, language: string): Promise<SttResult> {
    if (this.providers.stt.transcribeWithMetadata) {
      return this.providers.stt.transcribeWithMetadata(audio, language);
    }

    return {
      text: await this.providers.stt.transcribe(audio, language),
      durationSeconds: 0,
    };
  }

  private async generateText(context: string, messages: ChatMessage[], options: LlmRequestOptions): Promise<LlmGenerationResult> {
    try {
      if (this.providers.llm.generateResponseWithUsage) {
        return await this.providers.llm.generateResponseWithUsage(context, messages, options);
      }

      const text = await this.providers.llm.generateResponse(context, messages, options);
      return {
        text,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    } catch (error) {
      logger.error({ error, model: options.model }, "Primary LLM provider failed");
      if (env.OPENAI_FALLBACK_MODEL && env.OPENAI_FALLBACK_MODEL !== options.model && this.providers.llm.generateResponseWithUsage) {
        try {
          return await this.providers.llm.generateResponseWithUsage(context, messages, {
            ...options,
            model: env.OPENAI_FALLBACK_MODEL,
            maxCompletionTokens: Math.min(options.maxCompletionTokens ?? 500, 400),
          });
        } catch (fallbackError) {
          logger.error({ fallbackError, fallbackModel: env.OPENAI_FALLBACK_MODEL }, "Fallback LLM model failed");
        }
      }

      logger.error({ error }, "Falling back to mock provider");
      const fallback = new MockLlmProvider();
      const text = await fallback.generateResponse(context, messages, options);
      return {
        text,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    }
  }

  private async streamGenerateText(
    context: string,
    messages: ChatMessage[],
    onToken: (token: string) => void,
    options: LlmRequestOptions,
  ): Promise<LlmGenerationResult> {
    try {
      if (this.providers.llm.streamResponse) {
        return await this.providers.llm.streamResponse(context, messages, onToken, options);
      }

      const nonStream = await this.generateText(context, messages, options);
      onToken(nonStream.text);
      return nonStream;
    } catch (error) {
      logger.error({ error, model: options.model }, "Primary streaming LLM provider failed");
      if (env.OPENAI_FALLBACK_MODEL && env.OPENAI_FALLBACK_MODEL !== options.model && this.providers.llm.streamResponse) {
        try {
          return await this.providers.llm.streamResponse(context, messages, onToken, {
            ...options,
            model: env.OPENAI_FALLBACK_MODEL,
            maxCompletionTokens: Math.min(options.maxCompletionTokens ?? 500, 400),
          });
        } catch (fallbackError) {
          logger.error({ fallbackError, fallbackModel: env.OPENAI_FALLBACK_MODEL }, "Fallback streaming model failed");
        }
      }

      logger.error({ error }, "Falling back to mock provider for streaming");
      const fallback = new MockLlmProvider();
      const text = await fallback.generateResponse(context, messages, options);
      onToken(text);
      return {
        text,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    }
  }

  private async resolveLlmOptions(userId: string): Promise<LlmRequestOptions> {
    const planType = await this.resolvePlanType(userId);

    if (planType === "ENTERPRISE") {
      return {
        model: env.OPENAI_MODEL_ENTERPRISE ?? env.OPENAI_MODEL_PRO ?? env.OPENAI_MODEL,
        maxCompletionTokens: 800,
        temperature: 0.6,
      };
    }

    if (planType === "PRO") {
      return {
        model: env.OPENAI_MODEL_PRO ?? env.OPENAI_MODEL,
        maxCompletionTokens: 600,
        temperature: 0.6,
      };
    }

    return {
      model: env.OPENAI_MODEL_FREE ?? env.OPENAI_MODEL,
      maxCompletionTokens: 350,
      temperature: 0.5,
    };
  }

  private async resolvePlanType(userId: string): Promise<"FREE" | "PRO" | "ENTERPRISE"> {
    const now = Date.now();
    const cached = this.planCache.get(userId);
    if (cached && cached.expiresAt > now) {
      return cached.planType;
    }

    let planType: "FREE" | "PRO" | "ENTERPRISE" = "FREE";

    try {
      const effectivePlan = await this.planCheckService.getEffectivePlanAccess(userId);
      planType = effectivePlan.type;
    } catch (error) {
      logger.warn({ error, userId }, "Could not resolve plan type from database, defaulting to FREE");
    }

    this.planCache.set(userId, {
      planType,
      expiresAt: now + 60_000,
    });

    return planType;
  }

  private async speak(userId: string, text: string, language: string): Promise<TtsResult> {
    try {
      const voiceSettings = await this.voiceRepository.getOrCreate(userId);
      const options: TtsVoiceOptions = {
        voiceId: voiceSettings.voiceId,
        speed: voiceSettings.speed,
        style: voiceSettings.style,
        stability: voiceSettings.stability,
      };

      if (this.providers.tts.speakWithMetadata) {
        return await this.providers.tts.speakWithMetadata(text, language, options);
      }

      const audioBuffer = await this.providers.tts.speak(text, language, options);
      return {
        audioBuffer,
        durationSeconds: 0,
        mimeType: "audio/mpeg",
      };
    } catch (error) {
      logger.error({ error }, "Primary TTS provider failed, using silent fallback audio");
      return {
        audioBuffer: Buffer.from(EMPTY_MP3_BASE64, "base64"),
        durationSeconds: 0,
        mimeType: "audio/mpeg",
      };
    }
  }
}
