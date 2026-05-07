import { authService } from "@/services/auth.service";
import { API_BASE, API_BASE_CANDIDATES } from "@/lib/api-config";
import { Sentry } from "@/lib/monitoring";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }

  isPlanUpgradeRequired(): boolean {
    return this.status === 403 && this.code === "PLAN_UPGRADE_REQUIRED";
  }

  isUnauthorized(): boolean {
    return this.status === 401;
  }

  isForbidden(): boolean {
    return this.status === 403;
  }
}

type JsonBody = Record<string, unknown> | Array<unknown> | null;

const API_REQUEST_TIMEOUT_MS = 30000;
const PREFERRED_API_BASE_STORAGE_KEY = "preferredApiBase";

let preferredApiBase: string | null = (() => {
  try {
    return localStorage.getItem(PREFERRED_API_BASE_STORAGE_KEY);
  } catch {
    return null;
  }
})();

function persistPreferredApiBase(baseUrl: string): void {
  preferredApiBase = baseUrl;
  try {
    localStorage.setItem(PREFERRED_API_BASE_STORAGE_KEY, baseUrl);
  } catch {
    // no-op in restricted storage environments
  }
}

function clearPreferredApiBase(): void {
  preferredApiBase = null;
  try {
    localStorage.removeItem(PREFERRED_API_BASE_STORAGE_KEY);
  } catch {
    // no-op in restricted storage environments
  }
}

function getBaseCandidatesInPriorityOrder(): string[] {
  const uniqueCandidates = Array.from(new Set([API_BASE, ...API_BASE_CANDIDATES]));
  if (!preferredApiBase || !uniqueCandidates.includes(preferredApiBase)) {
    return uniqueCandidates;
  }

  return [preferredApiBase, ...uniqueCandidates.filter((candidate) => candidate !== preferredApiBase)];
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function parseErrorResponse(response: Response): Promise<ApiError> {
  try {
    const payload = (await response.json()) as {
      message?: string;
      code?: string;
      details?: Record<string, unknown>;
      error?: { 
        message?: string; 
        code?: string; 
        details?: Record<string, unknown>;
      };
    };

    const message = payload.error?.message || payload.message || "Request failed";
    const code = payload.error?.code || payload.code;
    const details = payload.error?.details || payload.details;
    return new ApiError(message, response.status, code, details);
  } catch {
    return new ApiError(`Request failed with status ${response.status}`, response.status);
  }
}

async function performRequest(path: string, init: RequestInit, retryOnUnauthorized = true): Promise<Response> {
  const accessToken = authService.getAccessToken();
  const baseHeaders = new Headers(init.headers ?? undefined);
  if (accessToken && !baseHeaders.has("Authorization")) {
    baseHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  const requestInit: RequestInit = {
    ...init,
    credentials: "include",
    headers: baseHeaders,
  };

  const baseCandidates = getBaseCandidatesInPriorityOrder();
  let response: Response | null = null;
  let lastError: unknown;

  for (const baseUrl of baseCandidates) {
    try {
      response = await fetchWithTimeout(`${baseUrl}${path}`, requestInit, API_REQUEST_TIMEOUT_MS);
      persistPreferredApiBase(baseUrl);
      break;
    } catch (error) {
      lastError = error;
      if (preferredApiBase === baseUrl) {
        clearPreferredApiBase();
      }
    }
  }

  if (!response) {
    Sentry.captureException(lastError instanceof Error ? lastError : new Error("API_UNREACHABLE"), {
      tags: {
        scope: "api_client",
        type: "network",
      },
      extra: {
        path,
        candidates: baseCandidates,
      },
    });

    throw new ApiError(
      `Network error while contacting API. Tried: ${baseCandidates.join(", ")}. ${lastError instanceof Error ? lastError.message : ""}`.trim(),
      0,
      "API_UNREACHABLE",
    );
  }

  if (response.status === 401 && retryOnUnauthorized) {
    try {
      await authService.refreshTokens();
      return performRequest(path, init, false);
    } catch {
      authService.clearTokens();
    }
  }

  return response;
}

async function request<T>(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: JsonBody): Promise<T> {
  const response = await performRequest(path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await parseErrorResponse(response);
    Sentry.captureException(error, {
      tags: {
        scope: "api_client",
        statusCode: String(response.status),
      },
      extra: {
        path,
        code: error.code,
      },
    });
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  get<T>(path: string): Promise<T> {
    return request<T>("GET", path);
  },
  post<T>(path: string, body: JsonBody): Promise<T> {
    return request<T>("POST", path, body);
  },
  put<T>(path: string, body: JsonBody): Promise<T> {
    return request<T>("PUT", path, body);
  },
  patch<T>(path: string, body: JsonBody): Promise<T> {
    return request<T>("PATCH", path, body);
  },
  delete<T>(path: string): Promise<T> {
    return request<T>("DELETE", path);
  },
};
