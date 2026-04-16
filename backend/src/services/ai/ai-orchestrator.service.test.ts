import { beforeEach, describe, expect, it, vi } from "vitest";

const mockProviders = {
  stt: {
    transcribeWithMetadata: vi.fn(),
    transcribe: vi.fn(),
  },
  llm: {
    generateResponseWithUsage: vi.fn(),
    generateResponse: vi.fn(),
    streamResponse: vi.fn(),
  },
  tts: {
    speakWithMetadata: vi.fn(),
    speak: vi.fn(),
  },
};

const mockVoiceRepositoryInstance = {
  getOrCreate: vi.fn(),
};

vi.mock("../../config/logger.js", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../modules/voice/voice.repository.js", () => ({
  VoiceRepository: vi.fn(() => mockVoiceRepositoryInstance),
}));

vi.mock("./providers.js", () => {
  class MockLlmProvider {
    async generateResponse(context: string, messages: Array<{ role: string; content: string }>) {
      const latest = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
      return `fallback:${latest}:${context.slice(0, 30)}`;
    }
  }

  return {
    createProviders: vi.fn(() => mockProviders),
    MockLlmProvider,
  };
});

import { AiOrchestratorService } from "./ai-orchestrator.service";

describe("AiOrchestratorService", () => {
  const ragService = {
    retrieveContext: vi.fn(),
    buildPrompt: vi.fn(),
  };

  const createService = () => {
    const service = new AiOrchestratorService(ragService as any);
    (service as any).planCheckService = {
      getEffectivePlanAccess: vi.fn().mockResolvedValue({
        type: "FREE",
        key: "free",
        source: "subscription",
      }),
    };

    return service;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    ragService.retrieveContext.mockReset();
    ragService.buildPrompt.mockReset();

    mockProviders.stt.transcribeWithMetadata.mockReset();
    mockProviders.stt.transcribe.mockReset();
    mockProviders.llm.generateResponseWithUsage.mockReset();
    mockProviders.llm.generateResponse.mockReset();
    mockProviders.llm.streamResponse.mockReset();
    mockProviders.tts.speakWithMetadata.mockReset();
    mockProviders.tts.speak.mockReset();

    mockVoiceRepositoryInstance.getOrCreate.mockReset();
    mockVoiceRepositoryInstance.getOrCreate.mockResolvedValue({
      voiceId: "voice-1",
      speed: 1,
      style: 0.5,
      stability: 0.5,
    });

    ragService.retrieveContext.mockResolvedValue(["Policy: refunds within 30 days", "Support: email support available"]);
    ragService.buildPrompt.mockImplementation((message: string, contexts: string[]) =>
      `Context:\n${contexts.join("\n")}\n\nUser:\n${message}`,
    );

    mockProviders.llm.generateResponseWithUsage.mockResolvedValue({
      text: "You can request a refund within 30 days via support.",
      usage: {
        promptTokens: 40,
        completionTokens: 20,
        totalTokens: 60,
      },
    });

    mockProviders.tts.speakWithMetadata.mockResolvedValue({
      audioBuffer: Buffer.from("tts-audio"),
      durationSeconds: 1.2,
      mimeType: "audio/mpeg",
    });
  });

  it("runs text-turn pipeline with RAG retrieval, prompting, LLM generation, and TTS", async () => {
    const service = createService();

    const result = await service.processTextTurn({
      userId: "user-a",
      text: "What is the refund policy?",
      language: "en",
    });

    expect(ragService.retrieveContext).toHaveBeenCalledWith("user-a", "What is the refund policy?", 3);

    expect(mockProviders.llm.generateResponseWithUsage).toHaveBeenCalledTimes(1);
    const [systemContext, messages] = mockProviders.llm.generateResponseWithUsage.mock.calls[0] as [string, Array<{ role: string; content: string }>];
    expect(systemContext).toContain("Security policy:");
    expect(systemContext).toContain("Retrieved context policy:");
    expect(systemContext).toContain("Retrieved context:");
    expect(systemContext).toContain("Respond primarily in en");
    expect(systemContext).toContain("Policy: refunds within 30 days");
    expect(systemContext).toContain("Support: email support available");
    expect(systemContext).toContain("User message:");
    expect(messages).toEqual([{ role: "user", content: "What is the refund policy?" }]);

    expect(mockProviders.tts.speakWithMetadata).toHaveBeenCalledWith(
      "You can request a refund within 30 days via support.",
      "en",
      expect.objectContaining({ voiceId: "voice-1" }),
    );

    expect(result.responseText).toContain("refund within 30 days");
    expect(result.ragContextCount).toBe(2);
    expect(result.tokenCount).toBe(60);
    expect(result.audioMimeType).toBe("audio/mpeg");
  });

  it("uses conversation history roles when provided", async () => {
    const service = createService();

    await service.processTextTurn({
      userId: "user-history",
      text: "continue",
      language: "en",
      history: [
        { role: "SYSTEM", content: "Keep replies concise" },
        { role: "USER", content: "Tell me about plan limits" },
        { role: "ASSISTANT", content: "Sure, here are limits" },
      ],
    });

    const [, messages] = mockProviders.llm.generateResponseWithUsage.mock.calls[0] as [string, Array<{ role: string; content: string }>];
    expect(messages).toEqual([
      { role: "system", content: "Keep replies concise" },
      { role: "user", content: "Tell me about plan limits" },
      { role: "assistant", content: "Sure, here are limits" },
    ]);
  });

  it("falls back to mock LLM response when primary LLM provider fails", async () => {
    mockProviders.llm.generateResponseWithUsage.mockRejectedValue(new Error("upstream llm outage"));
    const service = createService();

    const result = await service.processTextTurn({
      userId: "user-llm-fallback",
      text: "Need billing info",
      language: "en",
    });

    expect(result.responseText).toContain("fallback:Need billing info");
    expect(result.tokenCount).toBe(0);
  });

  it("returns silent fallback audio when TTS provider fails", async () => {
    mockProviders.tts.speakWithMetadata.mockRejectedValue(new Error("tts failure"));
    const service = createService();

    const result = await service.processTextTurn({
      userId: "user-tts-fallback",
      text: "hello",
      language: "en",
    });

    expect(result.audioMimeType).toBe("audio/mpeg");
    expect(result.audioBase64).toBe("SUQzAwAAAAAA");
    expect(result.ttsDurationSeconds).toBe(0);
  });

  it("streams text turn and emits provider tokens", async () => {
    mockProviders.llm.streamResponse.mockImplementation(async (_context, _messages, onToken) => {
      onToken("hello");
      onToken(" world");
      return {
        text: "hello world",
        usage: {
          promptTokens: 5,
          completionTokens: 2,
          totalTokens: 7,
        },
      };
    });

    const onToken = vi.fn();
    const service = createService();

    const result = await service.streamTextTurn(
      {
        userId: "user-stream",
        text: "stream me",
        language: "en",
      },
      onToken,
    );

    expect(onToken).toHaveBeenCalledTimes(2);
    expect(onToken).toHaveBeenNthCalledWith(1, "hello");
    expect(onToken).toHaveBeenNthCalledWith(2, " world");
    expect(result.responseText).toBe("hello world");
    expect(result.tokenCount).toBe(7);
  });

  it("processes voice turns by transcribing audio before RAG+LLM", async () => {
    mockProviders.stt.transcribeWithMetadata.mockResolvedValue({
      text: "What are your business hours?",
      durationSeconds: 2.5,
    });

    const service = createService();
    const result = await service.processVoiceTurn({
      userId: "user-voice",
      audioChunk: Buffer.from("fake-audio"),
      language: "en",
    });

    expect(mockProviders.stt.transcribeWithMetadata).toHaveBeenCalledTimes(1);
    expect(ragService.retrieveContext).toHaveBeenCalledWith("user-voice", "What are your business hours?", 3);
    expect(result.transcript).toBe("What are your business hours?");
    expect(result.sttDurationSeconds).toBe(2.5);
  });
});