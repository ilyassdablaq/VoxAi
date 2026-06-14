import { AppError } from "../../common/errors/app-error.js";
import { assertTenantAccess } from "../../common/services/tenant-guard.service.js";
import { usageTracker } from "../../common/services/usage-tracker.service.js";
import { ConversationRepository } from "../conversation/conversation.repository.js";
import { AiOrchestratorService } from "../../services/ai/ai-orchestrator.service.js";
import { ApiChatInput } from "./public-api.schemas.js";

/**
 * Public REST API surface for developer API keys (`vox_…`). Mirrors a single
 * text turn of the WebSocket flow but as a stateless request/response call, so
 * server-side clients can integrate without a socket.
 */
export class PublicApiService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly aiOrchestratorService: AiOrchestratorService,
  ) {}

  async chat(userId: string, payload: ApiChatInput) {
    const language = payload.language ?? "en";

    let conversationId = payload.conversationId;
    if (conversationId) {
      const conversation = await this.conversationRepository.getConversationById(conversationId);
      if (!conversation) {
        throw new AppError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
      }
      try {
        assertTenantAccess(conversation.userId, userId, "conversation");
      } catch {
        throw new AppError(403, "FORBIDDEN", "Conversation does not belong to this account");
      }
    } else {
      const conversation = await this.conversationRepository.createConversation({
        userId,
        title: "API Chat",
        language,
      });
      conversationId = conversation.id;
    }

    await this.conversationRepository.createMessage({
      conversationId,
      role: "USER",
      content: payload.message,
    });

    const history = await this.conversationRepository.getRecentMessages(conversationId, 20);

    const ai = await this.aiOrchestratorService.processTextTurn({
      userId,
      text: payload.message,
      language,
      history: history.map((message) => ({ role: message.role, content: message.content })),
    });

    const assistantMessage = await this.conversationRepository.createMessage({
      conversationId,
      role: "ASSISTANT",
      content: ai.responseText,
      tokenCount: ai.tokenCount,
      audioUrl: `data:${ai.audioMimeType};base64,${ai.audioBase64}`,
    });

    await usageTracker.record({
      userId,
      conversationId,
      tokensUsed: ai.tokenCount ?? 0,
      minutesUsed: (ai.ttsDurationSeconds ?? 0) / 60,
      source: "api.completion",
    });

    return {
      conversationId,
      message: {
        id: assistantMessage.id,
        role: "ASSISTANT" as const,
        content: ai.responseText,
        createdAt: assistantMessage.createdAt,
      },
      audio: {
        base64: ai.audioBase64,
        mimeType: ai.audioMimeType,
      },
      usage: {
        tokenCount: ai.tokenCount ?? 0,
        promptTokens: ai.promptTokens,
        completionTokens: ai.completionTokens,
      },
    };
  }
}
