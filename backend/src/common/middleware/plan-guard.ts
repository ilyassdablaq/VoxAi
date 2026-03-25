import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../errors/app-error.js";
import { planCheckService } from "../services/plan-check.service.js";
import { PlanType, PLAN_TYPES } from "../constants/plan.constants.js";

/**
 * Middleware factory: require minimum plan to access route
 * Usage: preHandler: [requiresPlan('PRO')]
 */
export function requiresPlan(minPlanType: PlanType) {
  return async function planGuard(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const userId = (request.user as { sub?: string } | undefined)?.sub;
    if (!userId) {
      throw new AppError(401, 'UNAUTHORIZED', 'User not authenticated');
    }

    const userPlan = await planCheckService.getUserPlan(userId);

    // Plan hierarchy check
    const planHierarchy: Record<PlanType, number> = {
      [PLAN_TYPES.FREE]: 0,
      [PLAN_TYPES.PRO]: 1,
      [PLAN_TYPES.ENTERPRISE]: 2,
    };

    const userLevel = planHierarchy[userPlan.type] ?? 0;
    const requiredLevel = planHierarchy[minPlanType] ?? 0;

    if (userLevel < requiredLevel) {
      throw new AppError(
        403,
        'PLAN_UPGRADE_REQUIRED',
        `This feature requires ${minPlanType} plan. Current plan: ${userPlan.type}`,
        { currentPlan: userPlan.type, requiredPlan: minPlanType }
      );
    }

    // Store plan in request for downstream handlers
    (request as any).planContext = {
      planType: userPlan.type,
      planKey: userPlan.key,
    };
  };
}
