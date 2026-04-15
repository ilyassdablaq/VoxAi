import { FastifyInstance } from "fastify";
import { RawData, WebSocket } from "ws";
import { AppError } from "../../common/errors/app-error.js";
import { AiOrchestratorService } from "../../services/ai/ai-orchestrator.service.js";
import { ConversationRepository } from "../../modules/conversation/conversation.repository.js";
import { assertTenantAccess } from "../../common/services/tenant-guard.service.js";

export function registerWebSocketGateway(
  fastify: FastifyInstance,
  aiOrchestratorService: AiOrchestratorService,
  conversationRepository: ConversationRepository,
): void {
  fastify.get("/ws/conversations/:id", { websocket: true }, async (socket, request) => {
    const typedSocket = socket as WebSocket;
    const { id: conversationId } = request.params as { id: string };
    let authenticatedUserId: string | null = null;
    let isAuthenticated = false;
    let isTextMessageInFlight = false;
    const authTimeout = setTimeout(() => {
      if (!isAuthenticated && typedSocket.readyState === WebSocket.OPEN) {
        typedSocket.send(
          JSON.stringify({
            type: "error",
            error: {
              message: "Authentication timed out",
            },
          }),
        );
        typedSocket.close(1008, "Authentication timed out");
      }
    }, 10_000);
    const heartbeatInterval = setInterval(() => {
      if (typedSocket.readyState === WebSocket.OPEN) {
        typedSocket.ping();
      }
    }, 25000);

    typedSocket.on("close", () => {
      clearTimeout(authTimeout);
      clearInterval(heartbeatInterval);
    });

    try {
      const authHeader = request.headers.authorization;

      if (authHeader) {
        await request.jwtVerify();
        const user = request.user as { sub: string };
        authenticatedUserId = user.sub;
        isAuthenticated = true;
      }
    } catch {
      typedSocket.send(
        JSON.stringify({
          type: "error",
          error: {
            message: "Authentication failed",
          },
        }),
      );
      typedSocket.close(1008, "Authentication failed");
      return;
    }

    socket.on("message", async (message: RawData) => {
      try {
        const payload = JSON.parse(String(message)) as {
          type: "auth" | "audio_chunk" | "text_message";
          data: string;
          language?: string;
          token?: string;
        };

        if (!payload.type || !payload.data) {
          throw new AppError(400, "INVALID_WS_PAYLOAD", "Invalid WebSocket payload");
        }

        if (!isAuthenticated) {
          if (payload.type !== "auth" || !payload.token) {
            throw new AppError(401, "UNAUTHORIZED", "Authentication required before sending chat messages");
          }

          request.headers.authorization = `Bearer ${payload.token}`;
          await request.jwtVerify();

          const user = request.user as { sub: string };
          authenticatedUserId = user.sub;

          const conversation = await conversationRepository.getConversationById(conversationId);
          if (!conversation) {
            typedSocket.send(
              JSON.stringify({
                type: "error",
                error: {
                  message: "Conversation not found",
                },
              }),
            );
            typedSocket.close(1008, "Unauthorized");
            return;
          }

          try {
            assertTenantAccess(conversation.userId, user.sub, "conversation");
          } catch {
            typedSocket.send(
              JSON.stringify({
                type: "error",
                error: {
                  message: "Unauthorized conversation access",
                },
              }),
            );
            typedSocket.close(1008, "Unauthorized");
            return;
          }

          isAuthenticated = true;
          return;
        }

        if (payload.type === "text_message") {
          if (!authenticatedUserId) {
            throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
          }

          if (isTextMessageInFlight) {
            typedSocket.send(
              JSON.stringify({
                type: "error",
                error: {
                  message: "A response is already being generated. Please wait.",
                },
              }),
            );
            return;
          }

          isTextMessageInFlight = true;

          await conversationRepository.createMessage({
            conversationId,
            role: "USER",
            content: payload.data,
          });

          const conversationHistory = await conversationRepository.getRecentMessages(conversationId, 20);

          const ai = await aiOrchestratorService.streamTextTurn(
            {
              userId: authenticatedUserId,
              text: payload.data,
              language: payload.language ?? "en",
              history: conversationHistory.map((message) => ({
                role: message.role,
                content: message.content,
              })),
            },
            (token) => {
              socket.send(
                JSON.stringify({
                  type: "assistant_delta",
                  data: { token },
                }),
              );
            },
          );

          const assistantMessage = await conversationRepository.createMessage({
            conversationId,
            role: "ASSISTANT",
            content: ai.responseText,
            tokenCount: ai.tokenCount,
            audioUrl: `data:${ai.audioMimeType};base64,${ai.audioBase64}`,
          });

          socket.send(
            JSON.stringify({
              type: "assistant_response",
              data: {
                id: assistantMessage.id,
                text: ai.responseText,
                createdAt: assistantMessage.createdAt,
                audioBase64: ai.audioBase64,
                audioMimeType: ai.audioMimeType,
                tokenCount: ai.tokenCount,
                promptTokens: ai.promptTokens,
                completionTokens: ai.completionTokens,
              },
            }),
          );
          isTextMessageInFlight = false;
          return;
        }

        if (!authenticatedUserId) {
          throw new AppError(401, "UNAUTHORIZED", "Authentication failed");
        }

        const ai = await aiOrchestratorService.processVoiceTurn({
          userId: authenticatedUserId,
          audioChunk: Buffer.from(payload.data, "base64"),
          language: payload.language ?? "en",
        });

        await conversationRepository.createMessage({
          conversationId,
          role: "USER",
          content: ai.transcript,
        });

        const assistantMessage = await conversationRepository.createMessage({
          conversationId,
          role: "ASSISTANT",
          content: ai.responseText,
          tokenCount: ai.tokenCount,
          audioUrl: `data:${ai.audioMimeType};base64,${ai.audioBase64}`,
        });

        socket.send(
          JSON.stringify({
            type: "transcription",
            data: { transcript: ai.transcript, durationSeconds: ai.sttDurationSeconds },
          }),
        );
        socket.send(
          JSON.stringify({
            type: "assistant_response",
            data: {
                id: assistantMessage.id,
              text: ai.responseText,
                createdAt: assistantMessage.createdAt,
              audioBase64: ai.audioBase64,
              audioMimeType: ai.audioMimeType,
              tokenCount: ai.tokenCount,
              promptTokens: ai.promptTokens,
              completionTokens: ai.completionTokens,
              ttsDurationSeconds: ai.ttsDurationSeconds,
            },
          }),
        );
      } catch (error) {
        isTextMessageInFlight = false;
        typedSocket.send(
          JSON.stringify({
            type: "error",
            error: {
              message: error instanceof Error ? error.message : "Unknown error",
            },
          }),
        );
      }
    });
  });
}
