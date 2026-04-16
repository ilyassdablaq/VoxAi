import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { authService } from "@/services/auth.service";
import { subscriptionService } from "@/services/subscription.service";
import { identifyUser, resetUserIdentity } from "@/lib/product-analytics";

export interface Subscription {
  plan: "FREE" | "PRO" | "ENTERPRISE";
  effectivePlan: "FREE" | "PRO" | "ENTERPRISE";
  isOverride: boolean;
  overrideExpiresAt: string | null;
  hasActiveSubscription: boolean;
  subscriptionId: string | null;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        try {
          const profile = await authService.getCurrentUser();
          if (!profile?.id) {
            setUser(null);
            setSubscription(null);
            return;
          }
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
          return;
        } catch (error) {
          if (!isAuthenticationFailure(error)) {
            throw error;
          }

          await authService.refreshTokens();
          const profile = await authService.getCurrentUser();
          if (!profile?.id) {
            setUser(null);
            setSubscription(null);
            return;
          }
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
          } catch (subscriptionError) {
            console.error("Failed to fetch subscription:", subscriptionError);
          }
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);
        authService.clearTokens();
        setUser(null);
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
    void Promise.resolve(authService.logout()).catch((error) => {
      console.error("Logout request failed:", error);
    });
    setUser(null);
    setSubscription(null);
    authService.clearTokens();
    resetUserIdentity();
  };

  const refreshSubscription = async () => {
    if (!user) return;
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
