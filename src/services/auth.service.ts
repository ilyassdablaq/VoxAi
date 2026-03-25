import { API_BASE, API_BASE_CANDIDATES } from "@/lib/api-config";

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";

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
}

async function parseAuthError(response: Response, fallback: string): Promise<Error> {
  try {
    const error = (await response.json()) as ApiErrorShape;
    return new Error(error.message || fallback);
  } catch {
    return new Error(fallback);
  }
}

async function performAuthFetch(path: string, init: RequestInit): Promise<Response> {
  const baseCandidates = Array.from(new Set([API_BASE, ...API_BASE_CANDIDATES]));
  let lastError: unknown;

  for (const baseUrl of baseCandidates) {
    try {
      return await fetch(`${baseUrl}${path}`, init);
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

    return response.json();
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await performAuthFetch(`/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) throw await parseAuthError(response, "Login failed");

    return response.json();
  },

  async refreshTokens(): Promise<{ accessToken: string; refreshToken: string }> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error("Missing refresh token");
    }

    const response = await performAuthFetch(`/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) throw await parseAuthError(response, "Token refresh failed");

    const tokens = (await response.json()) as { accessToken: string; refreshToken: string };
    this.setTokens(tokens.accessToken, tokens.refreshToken);
    return tokens;
  },

  async getCurrentUser(): Promise<UserProfile> {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error("Missing access token");
    }

    const response = await performAuthFetch(`/api/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw await parseAuthError(response, "Failed to fetch user profile");
    }

    return response.json() as Promise<UserProfile>;
  },

  setTokens(accessToken: string, refreshToken: string, persist = true): void {
    if (persist) {
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);
      return;
    }

    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY) ?? sessionStorage.getItem(ACCESS_TOKEN_KEY);
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY) ?? sessionStorage.getItem(REFRESH_TOKEN_KEY);
  },

  clearTokens(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  isLoggedIn(): boolean {
    const accessToken = this.getAccessToken();
    if (!accessToken) {
      return false;
    }

    const payload = decodeAccessToken(accessToken);
    if (!payload?.exp) {
      this.clearTokens();
      return false;
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp <= nowInSeconds) {
      this.clearTokens();
      return false;
    }

    return true;
  },

  decodeToken(token: string): JwtPayload | null {
    return decodeAccessToken(token);
  },
};
