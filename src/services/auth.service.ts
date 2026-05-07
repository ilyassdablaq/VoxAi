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

const ACCESS_TOKEN_STORAGE_KEY = "auth.accessToken";
const REFRESH_TOKEN_STORAGE_KEY = "auth.refreshToken";

let accessTokenCache: string | null = null;
let refreshTokenCache: string | null = null;

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
      const headers = new Headers(init.headers ?? undefined);
      if (!headers.has("Authorization") && accessTokenCache) {
        headers.set("Authorization", `Bearer ${accessTokenCache}`);
      }

      return await fetch(`${baseUrl}${path}`, {
        ...init,
        credentials: "include",
        headers,
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

function setStoredValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // no-op in restricted storage environments
  }
}

function getStoredValue(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function removeStoredValue(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // no-op in restricted storage environments
  }
}

function ensureTokenCachesLoaded(): void {
  if (accessTokenCache === null) {
    accessTokenCache = getStoredValue(ACCESS_TOKEN_STORAGE_KEY);
  }

  if (refreshTokenCache === null) {
    refreshTokenCache = getStoredValue(REFRESH_TOKEN_STORAGE_KEY);
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
    authService.setTokens(payload.accessToken, payload.refreshToken, true);
    trackEvent("user_registered", {
      method: "password",
      role: payload.user.role,
    });
    return payload;
  },

  async login(email: string, password: string, persist = true): Promise<AuthResponse> {
    const response = await performAuthFetch(`/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) throw await parseAuthError(response, "Login failed");

    const payload = (await response.json()) as AuthResponse;
    authService.setTokens(payload.accessToken, payload.refreshToken, persist);
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

    const payload = (await response.json()) as { accessToken: string; refreshToken: string };
    authService.setTokens(payload.accessToken, payload.refreshToken, true);
    return payload;
  },

  async logout(): Promise<void> {
    await performAuthFetch(`/api/auth/logout`, {
      method: "POST",
    });
    authService.clearTokens();
  },

  async getCurrentUser(): Promise<UserProfile> {
    const response = await performAuthFetch(`/api/users/me`, {
    });

    if (!response.ok) {
      throw await parseAuthError(response, "Failed to fetch user profile");
    }

    return response.json() as Promise<UserProfile>;
  },

  setTokens(nextAccessToken: string, nextRefreshToken: string, persist = true): void {
    accessTokenCache = nextAccessToken;
    refreshTokenCache = nextRefreshToken;

    if (!persist) {
      removeStoredValue(ACCESS_TOKEN_STORAGE_KEY);
      removeStoredValue(REFRESH_TOKEN_STORAGE_KEY);
      return;
    }

    setStoredValue(ACCESS_TOKEN_STORAGE_KEY, nextAccessToken);
    setStoredValue(REFRESH_TOKEN_STORAGE_KEY, nextRefreshToken);
  },

  getAccessToken(): string | null {
    ensureTokenCachesLoaded();
    return accessTokenCache;
  },

  getRefreshToken(): string | null {
    ensureTokenCachesLoaded();
    return refreshTokenCache;
  },

  clearTokens(): void {
    accessTokenCache = null;
    refreshTokenCache = null;
    removeStoredValue(ACCESS_TOKEN_STORAGE_KEY);
    removeStoredValue(REFRESH_TOKEN_STORAGE_KEY);
  },

  isLoggedIn(): boolean {
    const token = authService.getAccessToken();
    if (!token) {
      return false;
    }

    const payload = decodeAccessToken(token);
    if (!payload?.exp) {
      return false;
    }

    return payload.exp * 1000 > Date.now();
  },

  decodeToken(token: string): JwtPayload | null {
    return decodeAccessToken(token);
  },
};
