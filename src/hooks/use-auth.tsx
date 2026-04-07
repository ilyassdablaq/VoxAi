import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { authService } from "@/services/auth.service";
import { subscriptionService } from "@/services/subscription.service";
import { identifyUser, resetUserIdentity } from "@/lib/product-analytics";

export interface Subscription {
  plan: "FREE" | "PRO" | "ENTERPRISE";
  effectivePlan: "FREE" | "PRO" | "ENTERPRISE";
  isOverride: boolean;
  overrideExpiresAt: string | null;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

export interface AuthContextType {
  user: User | null;
  subscription: Subscription | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  isPro: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthErrorLike {
  status?: number;
  code?: string;
  message?: string;
}

function isAuthenticationFailure(error: unknown): boolean {
  const typedError = error as AuthErrorLike | null;
  if (!typedError) {
    return false;
  }

  if (typedError.status === 401) {
    return true;
  }

  if (typedError.code === "UNAUTHORIZED") {
    return true;
  }

  return /unauthorized|invalid or missing authentication token/i.test(typedError.message || "");
}

function hydrateUserFromToken(): User | null {
  const accessToken = authService.getAccessToken();
  if (!accessToken) {
    return null;
  }

  const payload = authService.decodeToken(accessToken);
  if (!payload?.sub) {
    return null;
  }

  return {
    id: payload.sub,
    email: payload.email || "",
    fullName: payload.fullName || payload.email || "User",
    role: payload.role || "USER",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const hasAccessToken = !!authService.getAccessToken();
        const hasRefreshToken = !!authService.getRefreshToken();

        if (!hasAccessToken && !hasRefreshToken) {
          setUser(null);
          setSubscription(null);
          return;
        }

        if (!authService.isLoggedIn() && hasRefreshToken) {
          await authService.refreshTokens();
        }

        const profile = await authService.getCurrentUser();
        setUser({
          id: profile.id,
          email: profile.email,
          fullName: profile.fullName,
          role: profile.role,
        });
        identifyUser(profile.id, {
          email: profile.email,
          role: profile.role,
        });

        try {
          const sub = await subscriptionService.getCurrentSubscription();
          setSubscription(sub);
        } catch (error) {
          console.error("Failed to fetch subscription:", error);
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);

        if (isAuthenticationFailure(error)) {
          authService.clearTokens();
          setUser(null);
        } else {
          setUser(hydrateUserFromToken());
        }

        setSubscription(null);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const login = async (email: string, password: string, rememberMe = true) => {
    setIsLoading(true);
    try {
      const response = await authService.login(email, password);
      setUser(response.user);
      identifyUser(response.user.id, {
        email: response.user.email,
        role: response.user.role,
      });
      authService.setTokens(response.accessToken, response.refreshToken, rememberMe);

      try {
        const sub = await subscriptionService.getCurrentSubscription();
        setSubscription(sub);
      } catch {
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    email: string,
    password: string,
    fullName: string
  ) => {
    setIsLoading(true);
    try {
      const response = await authService.register(email, password, fullName);
      setUser(response.user);
      identifyUser(response.user.id, {
        email: response.user.email,
        role: response.user.role,
      });
      authService.setTokens(response.accessToken, response.refreshToken);

      try {
        const sub = await subscriptionService.getCurrentSubscription();
        setSubscription(sub);
      } catch {
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setSubscription(null);
    authService.clearTokens();
    resetUserIdentity();
  };

  const refreshSubscription = async () => {
    if (!authService.getAccessToken()) return;
    try {
      const sub = await subscriptionService.getCurrentSubscription();
      setSubscription(sub);
    } catch (error) {
      console.error("Failed to refresh subscription:", error);
    }
  };

  const isPro =
    subscription?.effectivePlan === "PRO" ||
    subscription?.effectivePlan === "ENTERPRISE";

  return (
    <AuthContext.Provider
      value={{
        user,
        subscription,
        isLoading,
        isLoggedIn: !!user,
        isPro,
        login,
        register,
        logout,
        refreshSubscription,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
