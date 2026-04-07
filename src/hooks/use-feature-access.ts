import { useAuth } from './use-auth';

/**
 * Hook to check feature access based on subscription plan
 */
export function useFeatureAccess() {
  const { subscription } = useAuth();

  const FEATURE_PLAN_MAP: Record<string, 'FREE' | 'PRO' | 'ENTERPRISE'> = {
    'workflows': 'PRO',
    'workflow_create': 'PRO',
    'workflow_execute': 'PRO',
    'analytics': 'PRO',
    'analytics_dashboard': 'PRO',
  };

  const planHierarchy: Record<string, number> = {
    'FREE': 0,
    'PRO': 1,
    'ENTERPRISE': 2,
  };

  const canAccess = (featureName: string): boolean => {
    if (!subscription) return false;

    const requiredPlan = FEATURE_PLAN_MAP[featureName];
    if (!requiredPlan) return true; // Feature not gated

    const userLevel = planHierarchy[subscription.effectivePlan] ?? 0;
    const requiredLevel = planHierarchy[requiredPlan] ?? 0;

    return userLevel >= requiredLevel;
  };

  return { canAccess };
}
