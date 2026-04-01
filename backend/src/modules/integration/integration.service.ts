import { AppError } from "../../common/errors/app-error.js";
import { ConversationRepository } from "../conversation/conversation.repository.js";
import { AiOrchestratorService } from "../../services/ai/ai-orchestrator.service.js";
import { IntegrationRepository } from "./integration.repository.js";
import { EmbedChatInput, IntegrationSettingsInput } from "./integration.schemas.js";
import { assertTenantAccess } from "../../common/services/tenant-guard.service.js";

export class IntegrationService {
  constructor(
    private readonly repository: IntegrationRepository,
    private readonly conversationRepository: ConversationRepository,
    private readonly aiOrchestratorService: AiOrchestratorService,
  ) {}

  async getSettings(userId: string) {
    return this.repository.getOrCreateByUserId(userId);
  }

  async updateSettings(userId: string, payload: IntegrationSettingsInput) {
    return this.repository.updateSettings(userId, payload);
  }

  async regenerateEmbedKey(userId: string) {
    return this.repository.regenerateEmbedKey(userId);
  }

  async processEmbedChat(payload: EmbedChatInput) {
    const integration = await this.repository.getByEmbedKey(payload.embedKey);
    if (!integration) {
      throw new AppError(401, "INVALID_EMBED_KEY", "Invalid embed key");
    }

    let conversationId = payload.conversationId;
    if (conversationId) {
      const conversation = await this.conversationRepository.getConversationById(conversationId);
      if (!conversation) {
        throw new AppError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
      }

      try {
        assertTenantAccess(conversation.userId, integration.userId, "conversation");
      } catch {
        throw new AppError(403, "FORBIDDEN", "Conversation does not belong to this embed key");
      }
    } else {
      const conversation = await this.conversationRepository.createConversation({
        userId: integration.userId,
        title: `Website Chat - ${integration.botName}`,
        language: payload.language ?? integration.language,
      });
      conversationId = conversation.id;
    }

    await this.conversationRepository.createMessage({
      conversationId,
      role: "USER",
      content: payload.message,
    });

    const conversationHistory = await this.conversationRepository.getRecentMessages(conversationId, 20);
    const ai = await this.aiOrchestratorService.processTextTurn({
      userId: integration.userId,
      text: payload.message,
      language: payload.language ?? integration.language,
      history: conversationHistory.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    });

    const assistantMessage = await this.conversationRepository.createMessage({
      conversationId,
      role: "ASSISTANT",
      content: ai.responseText,
      tokenCount: ai.tokenCount,
      audioUrl: `data:${ai.audioMimeType};base64,${ai.audioBase64}`,
    });

    return {
      conversationId,
      botName: integration.botName,
      message: {
        id: assistantMessage.id,
        role: "ASSISTANT",
        content: ai.responseText,
        createdAt: assistantMessage.createdAt,
      },
    };
  }
}
