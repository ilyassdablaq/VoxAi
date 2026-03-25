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
  'workflows': PLAN_TYPES.PRO,
  'workflow_create': PLAN_TYPES.PRO,
  'workflow_update': PLAN_TYPES.PRO,
  'workflow_delete': PLAN_TYPES.PRO,
  'workflow_execute': PLAN_TYPES.PRO,
  'analytics': PLAN_TYPES.PRO,
  'analytics_dashboard': PLAN_TYPES.PRO,
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
