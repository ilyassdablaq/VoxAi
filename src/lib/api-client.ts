import { authService } from "@/services/auth.service";
import { API_BASE } from "@/lib/api-config";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type JsonBody = Record<string, unknown> | Array<unknown> | null;

async function parseErrorResponse(response: Response): Promise<ApiError> {
  try {
    const payload = (await response.json()) as {
      message?: string;
      code?: string;
      error?: { message?: string; code?: string; details?: unknown };
    };

    const message = payload.error?.message || payload.message || "Request failed";
    const code = payload.error?.code || payload.code;
    return new ApiError(message, response.status, code);
  } catch {
    return new ApiError(`Request failed with status ${response.status}`, response.status);
  }
}

async function performRequest(path: string, init: RequestInit, retryOnUnauthorized = true): Promise<Response> {
  const token = authService.getAccessToken();

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

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
