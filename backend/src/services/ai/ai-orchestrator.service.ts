import { logger } from "../../config/logger.js";
import { VoiceRepository } from "../../modules/voice/voice.repository.js";
import { RagService } from "../rag/rag.service.js";
import {
  ChatMessage,
  LlmGenerationResult,
  MockLlmProvider,
  ProviderSet,
  SttResult,
  TtsResult,
  TtsVoiceOptions,
  createProviders,
} from "./providers.js";

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

export class AiOrchestratorService {
  private readonly providers: ProviderSet;
  private readonly voiceRepository: VoiceRepository;

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

    const contexts = await this.ragService.retrieveContext(input.userId, sttResult.text, 3);
    const ragContext = this.ragService.buildPrompt(sttResult.text, contexts);

    const llmMessages = input.history?.length
      ? input.history.map((message) => ({
          role: normalizeRole(message.role),
          content: message.content,
        }))
      : [
          {
            role: "user" as const,
            content: sttResult.text,
          },
        ];

    const llmResult = await this.generateText(`${ragContext}\n\n${buildLanguageInstructions(input.language)}`, llmMessages);

    const ttsResult = await this.speak(input.userId, llmResult.text, input.language);

    return {
      transcript: sttResult.text,
      responseText: llmResult.text,
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
    const contexts = await this.ragService.retrieveContext(input.userId, input.text, 3);
    const ragContext = this.ragService.buildPrompt(input.text, contexts);

    const llmMessages = input.history?.length
      ? input.history.map((message) => ({
          role: normalizeRole(message.role),
          content: message.content,
        }))
      : [
          {
            role: "user" as const,
            content: input.text,
          },
        ];

    const llmResult = await this.generateText(`${ragContext}\n\n${buildLanguageInstructions(input.language)}`, llmMessages);

    const ttsResult = await this.speak(input.userId, llmResult.text, input.language);

    return {
      responseText: llmResult.text,
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
    const contexts = await this.ragService.retrieveContext(input.userId, input.text, 3);
    const ragContext = this.ragService.buildPrompt(input.text, contexts);

    const llmMessages = input.history?.length
      ? input.history.map((message) => ({
          role: normalizeRole(message.role),
          content: message.content,
        }))
      : [
          {
            role: "user" as const,
            content: input.text,
          },
        ];

    const llmResult = await this.streamGenerateText(`${ragContext}\n\n${buildLanguageInstructions(input.language)}`, llmMessages, onToken);

    const ttsResult = await this.speak(input.userId, llmResult.text, input.language);

    return {
      responseText: llmResult.text,
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

  private async generateText(context: string, messages: ChatMessage[]): Promise<LlmGenerationResult> {
    try {
      if (this.providers.llm.generateResponseWithUsage) {
        return await this.providers.llm.generateResponseWithUsage(context, messages);
      }

      const text = await this.providers.llm.generateResponse(context, messages);
      return {
        text,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    } catch (error) {
      logger.error({ error }, "Primary LLM provider failed, falling back to mock provider");
      const fallback = new MockLlmProvider();
      const text = await fallback.generateResponse(context, messages);
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
  ): Promise<LlmGenerationResult> {
    try {
      if (this.providers.llm.streamResponse) {
        return await this.providers.llm.streamResponse(context, messages, onToken);
      }

      const nonStream = await this.generateText(context, messages);
      onToken(nonStream.text);
      return nonStream;
    } catch (error) {
      logger.error({ error }, "Primary streaming LLM provider failed, falling back to mock provider");
      const fallback = new MockLlmProvider();
      const text = await fallback.generateResponse(context, messages);
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
