import { apiClient } from "@/lib/api-client";
import { API_BASE } from "@/lib/api-config";
import { authService } from "@/services/auth.service";

export interface KnowledgeDocumentItem {
  id: string;
  title: string;
  createdAt: string;
  _count: {
    chunks: number;
  };
}

export interface IngestionResult {
  document: {
    id: string;
    title: string;
    createdAt: string;
  };
  chunksCount: number;
  wordCount: number;
}

export const knowledgeService = {
  listDocuments(): Promise<KnowledgeDocumentItem[]> {
    return apiClient.get<KnowledgeDocumentItem[]>("/api/knowledge/documents");
  },

  async uploadFile(file: File, onProgress?: (value: number) => void): Promise<IngestionResult> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name);

    return new Promise<IngestionResult>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("POST", `${API_BASE}/api/knowledge/ingest/file`);

      const accessToken = authService.getAccessToken();
      if (accessToken) {
        request.setRequestHeader("Authorization", `Bearer ${accessToken}`);
      }

      request.upload.onprogress = (event) => {
        if (!event.lengthComputable || !onProgress) {
          return;
        }
        const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
        onProgress(percent);
      };

      request.onerror = () => {
        reject(new Error("Network error while uploading file"));
      };

      request.onload = () => {
        try {
          const parsed = JSON.parse(request.responseText || "{}") as {
            error?: { message?: string };
            message?: string;
          };

          if (request.status >= 200 && request.status < 300) {
            resolve(parsed as unknown as IngestionResult);
            return;
          }

          reject(new Error(parsed.error?.message || parsed.message || `Upload failed with status ${request.status}`));
        } catch {
          reject(new Error(`Upload failed with status ${request.status}`));
        }
      };

      request.send(formData);
    });
  },

  ingestStructured(format: "json" | "xml", title: string, content: string): Promise<IngestionResult> {
    return apiClient.post<IngestionResult>("/api/knowledge/ingest/structured", {
      format,
      title,
      content,
    });
  },

  ingestUrl(url: string, maxPages = 4): Promise<IngestionResult> {
    return apiClient.post<IngestionResult>("/api/knowledge/ingest/url", {
      url,
      maxPages,
    });
  },

  async deleteDocument(id: string): Promise<void> {
    await apiClient.delete<void>(`/api/knowledge/documents/${id}`);
  },
};
