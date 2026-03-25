import { apiClient } from "@/lib/api-client";
import { API_BASE, API_BASE_CANDIDATES } from "@/lib/api-config";
import { authService } from "@/services/auth.service";

export interface ConversationMessage {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  tokenCount?: number | null;
  audioUrl?: string | null;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  title?: string;
  language: string;
  status: string;
  createdAt: string;
}

export interface AssistantResponseEvent {
  type: "assistant_response";
  data: {
    id?: string;
    text: string;
    createdAt?: string;
    audioBase64?: string;
    audioMimeType?: string;
    tokenCount?: number;
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface AssistantDeltaEvent {
  type: "assistant_delta";
  data: {
    token: string;
  };
}

export interface TranscriptionEvent {
  type: "transcription";
  data: {
    transcript: string;
    durationSeconds: number;
  };
}

export interface ErrorEventPayload {
  type: "error";
  error: {
    message: string;
  };
}

export type ConversationSocketEvent = AssistantResponseEvent | AssistantDeltaEvent | TranscriptionEvent | ErrorEventPayload;

const WS_BASE_CANDIDATES = Array.from(new Set([API_BASE, ...API_BASE_CANDIDATES]));
let wsBaseIndex = 0;

function buildWebSocketUrl(baseUrl: string, conversationId: string, token: string) {
  const parsed = new URL(baseUrl);
  const protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${parsed.host}/ws/conversations/${conversationId}?token=${encodeURIComponent(token)}`;
}

export const conversationService = {
  listConversations(): Promise<ConversationSummary[]> {
    return apiClient.get<ConversationSummary[]>("/api/conversations");
  },

  createConversation(payload: { title: string; language?: string; initialMessage?: string }): Promise<ConversationSummary> {
    return apiClient.post<ConversationSummary>("/api/conversations", {
      title: payload.title,
      language: payload.language ?? "en",
      initialMessage: payload.initialMessage,
    });
  },

  getMessages(conversationId: string): Promise<ConversationMessage[]> {
    return apiClient.get<ConversationMessage[]>(`/api/conversations/${conversationId}/messages`);
  },

  async renameConversation(conversationId: string, title: string): Promise<void> {
    await apiClient.patch<void>(`/api/conversations/${conversationId}`, { title });
  },

  async deleteConversation(conversationId: string): Promise<void> {
    await apiClient.delete<void>(`/api/conversations/${conversationId}`);
  },

  createSocket(conversationId: string): WebSocket {
    const accessToken = authService.getAccessToken();
    if (!accessToken) {
      throw new Error("You must be signed in to open this conversation.");
    }

    const selectedBase = WS_BASE_CANDIDATES[wsBaseIndex % WS_BASE_CANDIDATES.length];
    wsBaseIndex += 1;

    return new WebSocket(buildWebSocketUrl(selectedBase, conversationId, accessToken));
  },
};
