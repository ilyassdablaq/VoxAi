import { API_BASE, API_BASE_CANDIDATES } from "@/lib/api-config";
import { trackEvent } from "@/lib/product-analytics";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

interface JwtPayload {
  sub?: string;
  email?: string;
  fullName?: string;
  role?: string;
  exp?: number;
}

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  fullName: string;
  role: "USER" | "ADMIN";
}

interface ApiErrorShape {
  message?: string;
  code?: string;
}

export class AuthServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}

async function parseAuthError(response: Response, fallback: string): Promise<AuthServiceError> {
  try {
    const error = (await response.json()) as ApiErrorShape;
    return new AuthServiceError(error.message || fallback, response.status, error.code);
  } catch {
    return new AuthServiceError(fallback, response.status);
  }
}

async function performAuthFetch(path: string, init: RequestInit): Promise<Response> {
  const baseCandidates = Array.from(new Set([API_BASE, ...API_BASE_CANDIDATES]));
  let lastError: unknown;

  for (const baseUrl of baseCandidates) {
    try {
      return await fetch(`${baseUrl}${path}`, {
        credentials: "include",
        ...init,
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Network error while contacting API. Tried: ${baseCandidates.join(", ")}. ${lastError instanceof Error ? lastError.message : ""}`.trim(),
  );
}

function decodeBase64Url(payloadPart: string): string {
  const padded = payloadPart.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payloadPart.length / 4) * 4, "=");
  return atob(padded);
}

function decodeAccessToken(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    return JSON.parse(decodeBase64Url(parts[1])) as JwtPayload;
  } catch {
    return null;
  }
}

export const authService = {
  async register(email: string, password: string, fullName: string): Promise<AuthResponse> {
    const response = await performAuthFetch(`/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, fullName }),
    });

    if (!response.ok) throw await parseAuthError(response, "Registration failed");

    const payload = (await response.json()) as AuthResponse;
    trackEvent("user_registered", {
      method: "password",
      role: payload.user.role,
    });
    return payload;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await performAuthFetch(`/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) throw await parseAuthError(response, "Login failed");

    const payload = (await response.json()) as AuthResponse;
    trackEvent("user_logged_in", {
      method: "password",
      role: payload.user.role,
    });
    return payload;
  },

  async refreshTokens(): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await performAuthFetch(`/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) throw await parseAuthError(response, "Token refresh failed");

    return (await response.json()) as { accessToken: string; refreshToken: string };
  },

  async logout(): Promise<void> {
    await performAuthFetch(`/api/auth/logout`, {
      method: "POST",
    });
  },

  async getCurrentUser(): Promise<UserProfile> {
    const response = await performAuthFetch(`/api/users/me`, {
    });

    if (!response.ok) {
      throw await parseAuthError(response, "Failed to fetch user profile");
    }

    return response.json() as Promise<UserProfile>;
  },

  setTokens(_accessToken: string, _refreshToken: string, _persist = true): void {},

  getAccessToken(): string | null {
    return null;
  },

  getRefreshToken(): string | null {
    return null;
  },

  clearTokens(): void {
  },

  isLoggedIn(): boolean {
    return false;
  },

  decodeToken(token: string): JwtPayload | null {
    return decodeAccessToken(token);
  },
};
