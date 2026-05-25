export const PLAN_TYPES = {
  FREE: 'FREE',
  PRO: 'PRO',
  ENTERPRISE: 'ENTERPRISE',
} as const;

export type PlanType = typeof PLAN_TYPES[keyof typeof PLAN_TYPES];

/**
 * Feature gating: which features require which plan minimum
 */
export const REQUIRED_PLAN_FOR_FEATURE: Record<string, PlanType> = {
  'analytics': PLAN_TYPES.FREE,
  'analytics_dashboard': PLAN_TYPES.FREE,
};

/**
 * Helper: Check if plan has feature access
 */
export function canAccessFeature(planType: PlanType, feature: string): boolean {
  const requiredPlan = REQUIRED_PLAN_FOR_FEATURE[feature];
  if (!requiredPlan) return true; // Feature not gated

  // Plan hierarchy: FREE < PRO < ENTERPRISE
  const planHierarchy: Record<PlanType, number> = {
    [PLAN_TYPES.FREE]: 0,
    [PLAN_TYPES.PRO]: 1,
    [PLAN_TYPES.ENTERPRISE]: 2,
  };

  return (planHierarchy[planType] ?? 0) >= (planHierarchy[requiredPlan] ?? 0);
}
