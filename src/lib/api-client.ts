import { authService } from "@/services/auth.service";
import { API_BASE, API_BASE_CANDIDATES } from "@/lib/api-config";

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

let preferredApiBase: string | null = null;

function getBaseCandidatesInPriorityOrder(): string[] {
  const uniqueCandidates = Array.from(new Set([API_BASE, ...API_BASE_CANDIDATES]));
  if (!preferredApiBase || !uniqueCandidates.includes(preferredApiBase)) {
    return uniqueCandidates;
  }

  return [preferredApiBase, ...uniqueCandidates.filter((candidate) => candidate !== preferredApiBase)];
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
  const token = authService.getAccessToken();

  const requestInit: RequestInit = {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };

  const baseCandidates = getBaseCandidatesInPriorityOrder();
  let response: Response | null = null;
  let lastError: unknown;

  for (const baseUrl of baseCandidates) {
    try {
      response = await fetch(`${baseUrl}${path}`, requestInit);
      preferredApiBase = baseUrl;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!response) {
    throw new ApiError(
      `Network error while contacting API. Tried: ${baseCandidates.join(", ")}. ${lastError instanceof Error ? lastError.message : ""}`.trim(),
      0,
      "API_UNREACHABLE",
    );
  }

  if (response.status === 401 && retryOnUnauthorized && authService.getRefreshToken()) {
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
    throw await parseErrorResponse(response);
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
