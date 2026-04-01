import { AppError } from "../../common/errors/app-error.js";
import { AiOrchestratorService } from "../../services/ai/ai-orchestrator.service.js";
import { UsageService } from "../billing/usage.service.js";
import { ConversationRepository } from "./conversation.repository.js";
import { CreateConversationInput, UpdateConversationInput } from "./conversation.schemas.js";
import { aiTasksQueue, enqueueWithPolicy, transcriptionQueue } from "../../infra/queue/queues.js";
import { publishDomainEvent } from "../../common/services/outbox.service.js";
import { assertTenantAccess } from "../../common/services/tenant-guard.service.js";

export class ConversationService {
  constructor(
    private readonly repository: ConversationRepository,
    private readonly usageService: UsageService,
    private readonly aiOrchestratorService: AiOrchestratorService,
  ) {}

  async createConversation(payload: CreateConversationInput, userId: string) {
    await this.usageService.enforcePlanLimits(userId);

    const conversation = await this.repository.createConversation({
      userId,
      title: payload.title,
      language: payload.language,
    });

    if (payload.initialMessage) {
      await this.repository.createMessage({
        conversationId: conversation.id,
        role: "USER",
        content: payload.initialMessage,
      });

      const conversationHistory = await this.repository.getRecentMessages(conversation.id, 20);

      const ai = await this.aiOrchestratorService.processTextTurn({
        userId,
        text: payload.initialMessage,
        language: payload.language,
        history: conversationHistory.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      });

      await this.repository.createMessage({
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: ai.responseText,
        tokenCount: ai.tokenCount,
        audioUrl: `data:${ai.audioMimeType};base64,${ai.audioBase64}`,
      });

      await this.usageService.trackUsage({
        userId,
        conversationId: conversation.id,
        minutesUsed: ai.ttsDurationSeconds / 60,
        tokensUsed: ai.tokenCount,
      });

      await enqueueWithPolicy(aiTasksQueue, "conversation-initial-response", {
        conversationId: conversation.id,
        userId,
      });
      await publishDomainEvent({
        eventId: `conversation-started:${conversation.id}`,
        eventType: "conversation.started",
        aggregateId: conversation.id,
        userId,
        payload: {
          conversationId: conversation.id,
        },
      });
      await enqueueWithPolicy(transcriptionQueue, "transcription-audit", {
        conversationId: conversation.id,
      });
    }

    return conversation;
  }

  async getConversationMessages(conversationId: string, userId: string) {
    const conversation = await this.repository.getConversationById(conversationId);
    if (!conversation) {
      throw new AppError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
    }

    assertTenantAccess(conversation.userId, userId, "conversation");

    return this.repository.getMessages(conversationId);
  }

  async listConversations(userId: string, page: number, limit: number) {
    return this.repository.listConversations(userId, page, limit);
  }

  async deleteConversation(conversationId: string, userId: string) {
    const result = await this.repository.deleteConversation(conversationId, userId);
    if (result.count === 0) {
      throw new AppError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
    }
  }

  async renameConversation(conversationId: string, userId: string, payload: UpdateConversationInput) {
    const result = await this.repository.updateConversationTitle(conversationId, userId, payload.title);
    if (result.count === 0) {
      throw new AppError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
    }
  }
}
