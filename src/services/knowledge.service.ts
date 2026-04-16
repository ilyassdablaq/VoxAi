import { apiClient } from "@/lib/api-client";
import { API_BASE, API_BASE_CANDIDATES } from "@/lib/api-config";

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

    const baseCandidates = Array.from(new Set([API_BASE, ...API_BASE_CANDIDATES]));
    const tryUpload = (baseUrl: string) =>
      new Promise<IngestionResult>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("POST", `${baseUrl}/api/knowledge/ingest/file`);
        request.withCredentials = true;

        request.upload.onprogress = (event) => {
          if (!event.lengthComputable || !onProgress) {
            return;
          }
          const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
          onProgress(percent);
        };

        request.onerror = () => {
          reject(new Error(`NETWORK_ERROR:${baseUrl}`));
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

    let lastError: unknown;
    for (const baseUrl of baseCandidates) {
      try {
        return await tryUpload(baseUrl);
      } catch (error) {
        lastError = error;
        if (!(error instanceof Error && error.message.startsWith("NETWORK_ERROR:"))) {
          throw error;
        }
      }
    }

    throw new Error(
      `Network error while uploading file. Tried: ${baseCandidates.join(", ")}. ${lastError instanceof Error ? lastError.message : ""}`.trim(),
    );
  },

  ingestStructured(format: "json" | "xml", title: string, content: string): Promise<IngestionResult> {
    return apiClient.post<IngestionResult>("/api/knowledge/ingest/structured", {
      format,
      title,
      content,
    });
  },

  ingestUrl(url: string, maxPages = 4): Promise<IngestionResult> {
    const normalizedUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    return apiClient.post<IngestionResult>("/api/knowledge/ingest/url", {
      url: normalizedUrl,
      maxPages,
    });
  },

  async deleteDocument(id: string): Promise<void> {
    await apiClient.delete<void>(`/api/knowledge/documents/${id}`);
  },
};
