import OpenAI from "openai";
import { createClient as createDeepgramClient } from "@deepgram/sdk";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { env } from "../../config/env.js"
import { logger } from "../../config/logger.js";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type SttResult = {
  text: string;
  durationSeconds: number;
};

export type LlmGenerationResult = {
  text: string;
  usage: LlmUsage;
};

export type TtsResult = {
  audioBuffer: Buffer;
  durationSeconds: number;
  mimeType: string;
};

export type TtsVoiceOptions = {
  voiceId?: string | null;
  speed?: number;
  style?: number;
  stability?: number;
};

export interface SttProvider {
  transcribe(audio: Buffer, language: string): Promise<string>;
  transcribeWithMetadata?(audio: Buffer, language: string): Promise<SttResult>;
}

export interface LlmProvider {
  generateResponse(context: string, messages: ChatMessage[]): Promise<string>;
  generateResponseWithUsage?(context: string, messages: ChatMessage[]): Promise<LlmGenerationResult>;
  streamResponse?(
    context: string,
    messages: ChatMessage[],
    onToken: (token: string) => void,
  ): Promise<LlmGenerationResult>;
}

export interface TtsProvider {
  speak(text: string, language: string, options?: TtsVoiceOptions): Promise<Buffer>;
  speakWithMetadata?(text: string, language: string, options?: TtsVoiceOptions): Promise<TtsResult>;
}

export type ProviderSet = {
  stt: SttProvider;
  llm: LlmProvider;
  tts: TtsProvider;
};

function estimateAudioDurationSeconds(buffer: Buffer): number {
  const bytesPerSecond =
    env.DEFAULT_AUDIO_SAMPLE_RATE * env.DEFAULT_AUDIO_CHANNELS * env.DEFAULT_AUDIO_BYTES_PER_SAMPLE;
  if (bytesPerSecond <= 0) {
    return 0;
  }
  return Number((buffer.length / bytesPerSecond).toFixed(3));
}

function estimateTtsDurationSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const averageWordsPerSecond = 2.6;
  return Number((words / averageWordsPerSecond).toFixed(3));
}

async function streamToBuffer(streamLike: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(streamLike)) {
    return streamLike;
  }

  if (streamLike && typeof streamLike === "object" && "arrayBuffer" in streamLike) {
    const arrayBuffer = await (streamLike as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of streamLike as AsyncIterable<Uint8Array | Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export class MockSttProvider implements SttProvider {
  async transcribe(_audio: Buffer, _language: string): Promise<string> {
    return "Transcribed user speech";
  }

  async transcribeWithMetadata(audio: Buffer, language: string): Promise<SttResult> {
    return {
      text: await this.transcribe(audio, language),
      durationSeconds: estimateAudioDurationSeconds(audio),
    };
  }
}

export class MockLlmProvider implements LlmProvider {
  async generateResponse(context: string, messages: ChatMessage[]): Promise<string> {
    const latestUserMessage = messages.filter((message) => message.role === "user").at(-1)?.content ?? "";
    return `AI response based on context (${context.slice(0, 60)}...) and message: ${latestUserMessage.slice(0, 80)}...`;
  }

  async generateResponseWithUsage(context: string, messages: ChatMessage[]): Promise<LlmGenerationResult> {
    const text = await this.generateResponse(context, messages);
    return {
      text,
      usage: {
        promptTokens: 80,
        completionTokens: 120,
        totalTokens: 200,
      },
    };
  }
}

export class MockTtsProvider implements TtsProvider {
  async speak(text: string, _language: string, _options?: TtsVoiceOptions): Promise<Buffer> {
    return Buffer.from(`MOCK_TTS_AUDIO:${text}`);
  }

  async speakWithMetadata(text: string, language: string, options?: TtsVoiceOptions): Promise<TtsResult> {
    const speed = options?.speed && options.speed > 0 ? options.speed : 1;
    const audioBuffer = await this.speak(text, language, options);
    return {
      audioBuffer,
      durationSeconds: Number((estimateTtsDurationSeconds(text) / speed).toFixed(3)),
      mimeType: "audio/mpeg",
    };
  }
}

export class OpenAiLlmProvider implements LlmProvider {
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateResponse(context: string, messages: ChatMessage[]): Promise<string> {
    const result = await this.generateResponseWithUsage(context, messages);
    return result.text;
  }

  async generateResponseWithUsage(context: string, messages: ChatMessage[]): Promise<LlmGenerationResult> {
    const completion = await this.client.chat.completions.create({
      model: env.OPENAI_MODEL,
      temperature: 0.6,
      max_completion_tokens: 500,
      messages: [
        {
          role: "system",
          content: context,
        },
        ...messages,
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    const usage = completion.usage;

    return {
      text,
      usage: {
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
        totalTokens: usage?.total_tokens ?? 0,
      },
    };
  }

  async streamResponse(
    context: string,
    messages: ChatMessage[],
    onToken: (token: string) => void,
  ): Promise<LlmGenerationResult> {
    let text = "";

    const stream = await this.client.chat.completions.create({
      model: env.OPENAI_MODEL,
      temperature: 0.6,
      max_completion_tokens: 500,
      stream: true,
      stream_options: { include_usage: true },
      messages: [
        {
          role: "system",
          content: context,
        },
        ...messages,
      ],
    });

    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? "";
      if (token) {
        text += token;
        onToken(token);
      }

      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens ?? 0;
        completionTokens = chunk.usage.completion_tokens ?? 0;
        totalTokens = chunk.usage.total_tokens ?? 0;
      }
    }

    return {
      text,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
      },
    };
  }
}

export class DeepgramSttProvider implements SttProvider {
  private readonly client: ReturnType<typeof createDeepgramClient>;

  constructor(apiKey: string) {
    this.client = createDeepgramClient(apiKey);
  }

  async transcribe(audio: Buffer, language: string): Promise<string> {
    const result = await this.transcribeWithMetadata(audio, language);
    return result.text;
  }

  async transcribeWithMetadata(audio: Buffer, language: string): Promise<SttResult> {
    const deepgramResponse = await this.client.listen.prerecorded.transcribeFile(audio, {
      model: env.DEEPGRAM_MODEL,
      language,
      smart_format: true,
    } as Record<string, unknown>);

    const transcript =
      (deepgramResponse as { result?: { results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string }> }> } } }).result?.results
        ?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";

    return {
      text: transcript,
      durationSeconds: estimateAudioDurationSeconds(audio),
    };
  }
}

export class ElevenLabsTtsProvider implements TtsProvider {
  private readonly client: ElevenLabsClient;

  constructor(apiKey: string) {
    this.client = new ElevenLabsClient({ apiKey });
  }

  async speak(text: string, language: string, options?: TtsVoiceOptions): Promise<Buffer> {
    const result = await this.speakWithMetadata(text, language, options);
    return result.audioBuffer;
  }

  async speakWithMetadata(text: string, _language: string, options?: TtsVoiceOptions): Promise<TtsResult> {
    const selectedVoiceId = options?.voiceId || env.ELEVENLABS_VOICE_ID;
    if (!selectedVoiceId) {
      throw new Error("ELEVENLABS_VOICE_ID is required for ElevenLabs TTS provider");
    }

    const requestPayload = {
      modelId: env.ELEVENLABS_MODEL,
      text,
      outputFormat: "mp3_44100_128" as const,
      voiceSettings: {
        stability: options?.stability ?? 0.5,
        style: options?.style ?? 0.5,
      },
    };

    const audioStream = await this.client.textToSpeech.convert(selectedVoiceId, requestPayload);

    const audioBuffer = await streamToBuffer(audioStream);
    const speed = options?.speed && options.speed > 0 ? options.speed : 1;

    return {
      audioBuffer,
      durationSeconds: Number((estimateTtsDurationSeconds(text) / speed).toFixed(3)),
      mimeType: "audio/mpeg",
    };
  }
}

export function createProviders(): ProviderSet {
  let stt: SttProvider = new MockSttProvider();
  let llm: LlmProvider = new MockLlmProvider();
  let tts: TtsProvider = new MockTtsProvider();

  if (env.STT_PROVIDER === "deepgram" && env.DEEPGRAM_API_KEY) {
    stt = new DeepgramSttProvider(env.DEEPGRAM_API_KEY);
  }

  if (env.LLM_PROVIDER === "openai" && env.OPENAI_API_KEY) {
    llm = new OpenAiLlmProvider(env.OPENAI_API_KEY);
  }

  if (env.TTS_PROVIDER === "elevenlabs" && env.ELEVENLABS_API_KEY) {
    tts = new ElevenLabsTtsProvider(env.ELEVENLABS_API_KEY);
  }

  logger.info(
    {
      sttProvider: env.STT_PROVIDER,
      llmProvider: env.LLM_PROVIDER,
      ttsProvider: env.TTS_PROVIDER,
      effectiveStt: stt.constructor.name,
      effectiveLlm: llm.constructor.name,
      effectiveTts: tts.constructor.name,
    },
    "AI providers initialized",
  );

  return { stt, llm, tts };
}
