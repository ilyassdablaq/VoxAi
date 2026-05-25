import { useAuth } from './use-auth';

/**
 * Hook to check feature access based on subscription plan
 */
export function useFeatureAccess() {
  const { subscription, user } = useAuth();

  const FEATURE_PLAN_MAP: Record<string, 'FREE' | 'PRO' | 'ENTERPRISE'> = {
    'analytics': 'FREE',
    'analytics_dashboard': 'FREE',
  };

  const planHierarchy: Record<string, number> = {
    'FREE': 0,
    'PRO': 1,
    'ENTERPRISE': 2,
  };

  const canAccess = (featureName: string): boolean => {
    const effectivePlan = subscription?.effectivePlan ?? (user ? 'FREE' : null);
    if (!effectivePlan) return false;

    const requiredPlan = FEATURE_PLAN_MAP[featureName];
    if (!requiredPlan) return true; // Feature not gated

    const userLevel = planHierarchy[effectivePlan] ?? 0;
    const requiredLevel = planHierarchy[requiredPlan] ?? 0;

    return userLevel >= requiredLevel;
  };

  return { canAccess };
}
