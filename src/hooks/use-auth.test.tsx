import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { AuthProvider, useAuth } from "./use-auth";

vi.mock("@/services/auth.service", () => ({
  authService: {
    getAccessToken: vi.fn(),
    getRefreshToken: vi.fn(),
    isLoggedIn: vi.fn(),
    refreshTokens: vi.fn(),
    getCurrentUser: vi.fn(),
    setTokens: vi.fn(),
    clearTokens: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
  },
}));

vi.mock("@/services/subscription.service", () => ({
  subscriptionService: {
    getCurrentSubscription: vi.fn(),
  },
}));

import { authService } from "@/services/auth.service";
import { subscriptionService } from "@/services/subscription.service";

describe("useAuth Hook", () => {
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    fullName: "Test User",
    role: "USER",
  };

  const mockSubscription = {
    plan: "FREE" as const,
    effectivePlan: "FREE" as const,
    isOverride: false,
    overrideExpiresAt: null,
  };

  const mockProSubscription = {
    ...mockSubscription,
    effectivePlan: "PRO" as const,
  };

  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with loading state", () => {
      vi.mocked(authService.getAccessToken).mockReturnValue(null);
      vi.mocked(authService.getRefreshToken).mockReturnValue(null);

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isLoggedIn).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it("should load user and subscription on mount if tokens exist", async () => {
      vi.mocked(authService.getAccessToken).mockReturnValue("access-token");
      vi.mocked(authService.getRefreshToken).mockReturnValue("refresh-token");
      vi.mocked(authService.isLoggedIn).mockReturnValue(true);
      vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(subscriptionService.getCurrentSubscription).mockResolvedValue(
        mockSubscription
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.subscription).toEqual(mockSubscription);
      expect(result.current.isLoggedIn).toBe(true);
    });

    it("should refresh tokens if only refresh token exists", async () => {
      vi.mocked(authService.getAccessToken).mockReturnValue(null);
      vi.mocked(authService.getRefreshToken).mockReturnValue("refresh-token");
      vi.mocked(authService.isLoggedIn).mockReturnValue(false);
      vi.mocked(authService.refreshTokens).mockResolvedValue(undefined);
      vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(subscriptionService.getCurrentSubscription).mockResolvedValue(
        mockSubscription
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(vi.mocked(authService.refreshTokens)).toHaveBeenCalled();
      expect(result.current.user).toEqual(mockUser);
    });

    it("should clear tokens and set user to null if initialization fails", async () => {
      vi.mocked(authService.getAccessToken).mockReturnValue("access-token");
      vi.mocked(authService.getRefreshToken).mockReturnValue("refresh-token");
      vi.mocked(authService.isLoggedIn).mockReturnValue(true);
      vi.mocked(authService.getCurrentUser).mockRejectedValue(
        new Error("Auth failed")
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(vi.mocked(authService.clearTokens)).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
      expect(result.current.isLoggedIn).toBe(false);
    });
  });

  describe("login", () => {
    beforeEach(() => {
      vi.mocked(authService.getAccessToken).mockReturnValue(null);
      vi.mocked(authService.getRefreshToken).mockReturnValue(null);
    });

    it("should set user and subscription on successful login", async () => {
      vi.mocked(authService.login).mockResolvedValue({
        user: mockUser,
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
      });
      vi.mocked(subscriptionService.getCurrentSubscription).mockResolvedValue(
        mockSubscription
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login("test@example.com", "password");
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.subscription).toEqual(mockSubscription);
      expect(result.current.isLoggedIn).toBe(true);
      expect(vi.mocked(authService.setTokens)).toHaveBeenCalledWith(
        "new-access-token",
        "new-refresh-token",
        true
      );
    });

    it("should support rememberMe parameter", async () => {
      vi.mocked(authService.login).mockResolvedValue({
        user: mockUser,
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
      });
      vi.mocked(subscriptionService.getCurrentSubscription).mockResolvedValue(
        mockSubscription
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login("test@example.com", "password", false);
      });

      expect(vi.mocked(authService.setTokens)).toHaveBeenCalledWith(
        "new-access-token",
        "new-refresh-token",
        false
      );
    });

    it("should continue even if subscription fetch fails", async () => {
      vi.mocked(authService.login).mockResolvedValue({
        user: mockUser,
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
      });
      vi.mocked(subscriptionService.getCurrentSubscription).mockRejectedValue(
        new Error("Subscription fetch failed")
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login("test@example.com", "password");
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.subscription).toBeNull();
      expect(result.current.isLoggedIn).toBe(true);
    });
  });

  describe("register", () => {
    beforeEach(() => {
      vi.mocked(authService.getAccessToken).mockReturnValue(null);
      vi.mocked(authService.getRefreshToken).mockReturnValue(null);
    });

    it("should register user and set auth state", async () => {
      vi.mocked(authService.register).mockResolvedValue({
        user: mockUser,
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
      });
      vi.mocked(subscriptionService.getCurrentSubscription).mockResolvedValue(
        mockSubscription
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.register("test@example.com", "password", "Test User");
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.subscription).toEqual(mockSubscription);
      expect(result.current.isLoggedIn).toBe(true);
      expect(vi.mocked(authService.register)).toHaveBeenCalledWith(
        "test@example.com",
        "password",
        "Test User"
      );
    });
  });

  describe("logout", () => {
    it("should clear user, subscription, and tokens on logout", async () => {
      vi.mocked(authService.getAccessToken).mockReturnValue("access-token");
      vi.mocked(authService.getRefreshToken).mockReturnValue("refresh-token");
      vi.mocked(authService.isLoggedIn).mockReturnValue(true);
      vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(subscriptionService.getCurrentSubscription).mockResolvedValue(
        mockSubscription
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.subscription).toBeNull();
      expect(result.current.isLoggedIn).toBe(false);
      expect(vi.mocked(authService.clearTokens)).toHaveBeenCalled();
    });
  });

  describe("refreshSubscription", () => {
    it("should update subscription when called", async () => {
      vi.mocked(authService.getAccessToken).mockReturnValue("access-token");
      vi.mocked(authService.getRefreshToken).mockReturnValue("refresh-token");
      vi.mocked(authService.isLoggedIn).mockReturnValue(true);
      vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(subscriptionService.getCurrentSubscription).mockResolvedValue(
        mockSubscription
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      const newSubscription = { ...mockSubscription, status: "ACTIVE" };
      vi.mocked(subscriptionService.getCurrentSubscription).mockResolvedValue(
        newSubscription
      );

      await act(async () => {
        await result.current.refreshSubscription();
      });

      expect(result.current.subscription).toEqual(newSubscription);
    });

    it("should do nothing if no access token", async () => {
      vi.mocked(authService.getAccessToken).mockReturnValue(null);
      vi.mocked(authService.getRefreshToken).mockReturnValue(null);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.refreshSubscription();
      });

      expect(
        vi.mocked(subscriptionService.getCurrentSubscription)
      ).not.toHaveBeenCalled();
    });
  });

  describe("isPro", () => {
    it("should return true for PRO subscription", async () => {
      vi.mocked(authService.getAccessToken).mockReturnValue("access-token");
      vi.mocked(authService.getRefreshToken).mockReturnValue("refresh-token");
      vi.mocked(authService.isLoggedIn).mockReturnValue(true);
      vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(subscriptionService.getCurrentSubscription).mockResolvedValue(
        mockProSubscription
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isPro).toBe(true);
      });
    });

    it("should return false for FREE subscription", async () => {
      vi.mocked(authService.getAccessToken).mockReturnValue("access-token");
      vi.mocked(authService.getRefreshToken).mockReturnValue("refresh-token");
      vi.mocked(authService.isLoggedIn).mockReturnValue(true);
      vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(subscriptionService.getCurrentSubscription).mockResolvedValue(
        mockSubscription
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isPro).toBe(false);
      });
    });
  });

  describe("error handling", () => {
    it("should throw error when useAuth is used outside AuthProvider", () => {
      expect(() => {
        renderHook(() => useAuth());
      }).toThrow("useAuth must be used within AuthProvider");
    });
  });
});
