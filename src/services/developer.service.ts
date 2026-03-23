import { apiClient } from "@/lib/api-client";

export interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  maskedPrefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface SnippetsResponse {
  restExample: string;
  websocketExample: string;
  javascriptExample: string;
  pythonExample: string;
}

export const developerService = {
  listApiKeys(): Promise<ApiKeyRecord[]> {
    return apiClient.get<ApiKeyRecord[]>("/api/developer/keys");
  },

  createApiKey(name: string): Promise<{ key: ApiKeyRecord; plainTextKey: string }> {
    return apiClient.post<{ key: ApiKeyRecord; plainTextKey: string }>("/api/developer/keys", { name });
  },

  revokeApiKey(id: string): Promise<void> {
    return apiClient.delete<void>(`/api/developer/keys/${id}`);
  },

  getSnippets(): Promise<SnippetsResponse> {
    return apiClient.get<SnippetsResponse>("/api/developer/snippets");
  },
};
