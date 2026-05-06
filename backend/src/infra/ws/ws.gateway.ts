import { FastifyInstance } from "fastify";
import { RawData, WebSocket } from "ws";
import { AppError } from "../../common/errors/app-error.js";
import { AiOrchestratorService } from "../../services/ai/ai-orchestrator.service.js";
import { ConversationRepository } from "../../modules/conversation/conversation.repository.js";
import { assertTenantAccess } from "../../common/services/tenant-guard.service.js";
import { usageTracker } from "../../common/services/usage-tracker.service.js";
import { logger } from "../../config/logger.js";
import { registerSocket, publishToConversation, sendLocal } from "./ws-broker.service.js";
import { tryLockConversation } from "./ws-mutex.service.js";
import { registerPresence, PRESENCE_HEARTBEAT_INTERVAL_MS } from "./ws-presence.service.js";

const AUTH_TIMEOUT_MS = 10_000;

interface IncomingPayload {
  type: "audio_chunk" | "text_message";
  data: string;
  language?: string;
}

function send(socket: WebSocket, payload: unknown): void {
  sendLocal(socket, payload);
}

function sendError(socket: WebSocket, message: string, code?: string): void {
  send(socket, { type: "error", error: { code, message } });
}

function tryParse(raw: RawData): IncomingPayload | null {
  try {
    const parsed = JSON.parse(String(raw)) as IncomingPayload;
    if (!parsed?.type || !parsed?.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function registerWebSocketGateway(
  fastify: FastifyInstance,
  aiOrchestratorService: AiOrchestratorService,
  conversationRepository: ConversationRepository,
): void {
  fastify.get("/ws/conversations/:id", { websocket: true }, async (socket, request) => {
    const typedSocket = socket as WebSocket;
    const { id: conversationId } = request.params as { id: string };

    let authenticatedUserId: string | null = null;
    let unregisterFromBroker: (() => void) | null = null;
    let presenceRelease: (() => Promise<void>) | null = null;

    const authTimeout = setTimeout(() => {
      if (!authenticatedUserId && typedSocket.readyState === WebSocket.OPEN) {
        sendError(typedSocket, "Authentication timed out", "AUTH_TIMEOUT");
        typedSocket.close(1008, "Authentication timed out");
      }
    }, AUTH_TIMEOUT_MS);

    let presenceHeartbeat: NodeJS.Timeout | null = null;
    const wsHeartbeat = setInterval(() => {
      if (typedSocket.readyState === WebSocket.OPEN) typedSocket.ping();
    }, 25_000);

    typedSocket.on("close", async () => {
      clearTimeout(authTimeout);
      clearInterval(wsHeartbeat);
      if (presenceHeartbeat) clearInterval(presenceHeartbeat);
      if (unregisterFromBroker) unregisterFromBroker();
      if (presenceRelease) await presenceRelease().catch(() => undefined);
    });

    // ---- 1. Authenticate ----
    try {
      let token: string | undefined;
      try {
        const url = new URL(request.url, `http://${request.headers.host}`);
        token = url.searchParams.get("token") ?? undefined;
      } catch {
        /* ignore url parse errors */
      }
      token = token ?? (request as { cookies?: { accessToken?: string } }).cookies?.accessToken;

      if (!token) {
        sendError(typedSocket, "Authentication required", "UNAUTHORIZED");
        typedSocket.close(1008, "Authentication required");
        return;
      }

      request.user = (await request.server.jwt.verify(token)) as typeof request.user;
      const user = request.user as { sub: string };
      authenticatedUserId = user.sub;
      clearTimeout(authTimeout);
    } catch {
      sendError(typedSocket, "Authentication failed", "UNAUTHORIZED");
      typedSocket.close(1008, "Authentication failed");
      return;
    }

    // ---- 2. Tenant guard ----
    const conversation = await conversationRepository.getConversationById(conversationId);
    if (!conversation) {
      sendError(typedSocket, "Conversation not found", "NOT_FOUND");
      typedSocket.close(1008, "Not found");
      return;
    }
    try {
      assertTenantAccess(conversation.userId, authenticatedUserId, "conversation");
    } catch {
      sendError(typedSocket, "Unauthorized conversation access", "FORBIDDEN");
      typedSocket.close(1008, "Unauthorized");
      return;
    }

    // ---- 3. Register with broker + presence ----
    unregisterFromBroker = registerSocket({
      socket: typedSocket,
      userId: authenticatedUserId,
      conversationId,
    });

    const presence = await registerPresence(authenticatedUserId);
    presenceRelease = presence.release;
    presenceHeartbeat = setInterval(() => {
      void presence.heartbeat();
    }, PRESENCE_HEARTBEAT_INTERVAL_MS);

    send(typedSocket, { type: "connected", data: { conversationId, connectionId: presence.connectionId } });

    // ---- 4. Message handler ----
    typedSocket.on("message", async (raw: RawData) => {
      if (!authenticatedUserId) return;

      const payload = tryParse(raw);
      if (!payload) {
        sendError(typedSocket, "Invalid WebSocket payload", "INVALID_PAYLOAD");
        return;
      }

      // Acquire per-conversation lock (cross-instance safe)
      const lock = await tryLockConversation(conversationId, 90_000);
      if (!lock) {
        sendError(typedSocket, "A response is already being generated. Please wait.", "BUSY");
        return;
      }

      const renewInterval = setInterval(() => {
        void lock.renew(90_000);
      }, 30_000);

      try {
        if (payload.type === "text_message") {
          await handleTextTurn({
            socket: typedSocket,
            conversationId,
            userId: authenticatedUserId,
            text: payload.data,
            language: payload.language ?? "en",
            ai: aiOrchestratorService,
            repo: conversationRepository,
          });
          return;
        }

        await handleVoiceTurn({
          socket: typedSocket,
          conversationId,
          userId: authenticatedUserId,
          audioBase64: payload.data,
          language: payload.language ?? "en",
          ai: aiOrchestratorService,
          repo: conversationRepository,
        });
      } catch (error) {
        const status = error instanceof AppError ? error.statusCode : 500;
        const code = error instanceof AppError ? error.code : "INTERNAL_ERROR";
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error({ error, conversationId, userId: authenticatedUserId, status, code }, "WS turn failed");
        sendError(typedSocket, message, code);
      } finally {
        clearInterval(renewInterval);
        await lock.release();
      }
    });
  });
}

// ----- handlers ------------------------------------------------------------

interface HandlerCommon {
  socket: WebSocket;
  conversationId: string;
  userId: string;
  language: string;
  ai: AiOrchestratorService;
  repo: ConversationRepository;
}

async function handleTextTurn(input: HandlerCommon & { text: string }): Promise<void> {
  const { socket, conversationId, userId, text, language, ai, repo } = input;

  await repo.createMessage({ conversationId, role: "USER", content: text });
  const history = await repo.getRecentMessages(conversationId, 20);

  const result = await ai.streamTextTurn(
    {
      userId,
      text,
      language,
      history: history.map((m) => ({ role: m.role, content: m.content })),
    },
    (token) => {
      // Local-only stream (no fanout for delta tokens — too chatty)
      send(socket, { type: "assistant_delta", data: { token } });
    },
  );

  const assistantMessage = await repo.createMessage({
    conversationId,
    role: "ASSISTANT",
    content: result.responseText,
    tokenCount: result.tokenCount,
    audioUrl: `data:${result.audioMimeType};base64,${result.audioBase64}`,
  });

  // Final message: fanout via Redis so all instances/tabs of this conversation see it
  await publishToConversation(conversationId, {
    type: "assistant_response",
    data: {
      id: assistantMessage.id,
      text: result.responseText,
      createdAt: assistantMessage.createdAt,
      audioBase64: result.audioBase64,
      audioMimeType: result.audioMimeType,
      tokenCount: result.tokenCount,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    },
  });

  // Centralized usage tracking
  await usageTracker.record({
    userId,
    conversationId,
    tokensUsed: result.tokenCount ?? 0,
    minutesUsed: (result.ttsDurationSeconds ?? 0) / 60,
    source: "ws.text",
  });
}

async function handleVoiceTurn(
  input: HandlerCommon & { audioBase64: string },
): Promise<void> {
  const { socket, conversationId, userId, audioBase64, language, ai, repo } = input;

  const result = await ai.processVoiceTurn({
    userId,
    audioChunk: Buffer.from(audioBase64, "base64"),
    language,
  });

  await repo.createMessage({ conversationId, role: "USER", content: result.transcript });
  const assistantMessage = await repo.createMessage({
    conversationId,
    role: "ASSISTANT",
    content: result.responseText,
    tokenCount: result.tokenCount,
    audioUrl: `data:${result.audioMimeType};base64,${result.audioBase64}`,
  });

  send(socket, {
    type: "transcription",
    data: { transcript: result.transcript, durationSeconds: result.sttDurationSeconds },
  });

  await publishToConversation(conversationId, {
    type: "assistant_response",
    data: {
      id: assistantMessage.id,
      text: result.responseText,
      createdAt: assistantMessage.createdAt,
      audioBase64: result.audioBase64,
      audioMimeType: result.audioMimeType,
      tokenCount: result.tokenCount,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      ttsDurationSeconds: result.ttsDurationSeconds,
    },
  });

  await usageTracker.record({
    userId,
    conversationId,
    tokensUsed: result.tokenCount ?? 0,
    minutesUsed: (result.sttDurationSeconds + (result.ttsDurationSeconds ?? 0)) / 60,
    source: "ws.voice",
  });
}
