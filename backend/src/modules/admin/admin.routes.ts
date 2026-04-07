import { FastifyInstance } from "fastify";
import { authenticate, authorize } from "../../common/middleware/auth-middleware.js";
import { validate } from "../../common/middleware/validate.js";
import { enforceAdminIpAllowlist } from "../../common/middleware/admin-ip-allowlist.js";
import { PlanCheckService } from "../../common/services/plan-check.service.js";
import { AdminRepository } from "./admin.repository.js";
import { AdminService } from "./admin.service.js";
import {
  adminUserParamsSchema,
  adminUserSearchQuerySchema,
  overrideHistoryQuerySchema,
  setPlanOverrideSchema,
  type AdminUserParamsInput,
  type AdminUserSearchQueryInput,
  type OverrideHistoryQueryInput,
  type SetPlanOverrideInput,
} from "./admin.schemas.js";

const adminPreHandlers = [authenticate, authorize(["ADMIN"]), enforceAdminIpAllowlist];
const adminRateLimitConfig = {
  rateLimit: {
    max: 60,
    timeWindow: "1 minute",
  },
};

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new AdminService(new AdminRepository(), new PlanCheckService());

  const resolveUserAgent = (value: string | string[] | undefined): string | undefined => {
    if (typeof value === "string") {
      return value;
    }

    if (Array.isArray(value)) {
      return value.join(", ");
    }

    return undefined;
  };

  fastify.get(
    "/api/admin/users/search",
    {
      preHandler: [...adminPreHandlers, validate({ query: adminUserSearchQuerySchema })],
      config: adminRateLimitConfig,
    },
    async (request) => {
      const { q, limit } = request.query as AdminUserSearchQueryInput;
      return service.searchUsers(q, limit);
    },
  );

  fastify.post(
    "/api/admin/users/:userId/subscription/override",
    {
      preHandler: [
        ...adminPreHandlers,
        validate({ params: adminUserParamsSchema, body: setPlanOverrideSchema }),
      ],
      config: adminRateLimitConfig,
    },
    async (request) => {
      const admin = request.user as { sub: string };
      const { userId } = request.params as AdminUserParamsInput;
      const payload = request.body as SetPlanOverrideInput;

      return service.setSubscriptionOverride(admin.sub, userId, payload, {
        ipAddress: request.ip,
        userAgent: resolveUserAgent(request.headers["user-agent"]),
      });
    },
  );

  fastify.delete(
    "/api/admin/users/:userId/subscription/override",
    {
      preHandler: [...adminPreHandlers, validate({ params: adminUserParamsSchema })],
      config: adminRateLimitConfig,
    },
    async (request, reply) => {
      const admin = request.user as { sub: string };
      const { userId } = request.params as AdminUserParamsInput;

      await service.removeSubscriptionOverride(admin.sub, userId, {
        ipAddress: request.ip,
        userAgent: resolveUserAgent(request.headers["user-agent"]),
      });

      return reply.status(204).send();
    },
  );

  fastify.get(
    "/api/admin/users/:userId/effective-access",
    {
      preHandler: [...adminPreHandlers, validate({ params: adminUserParamsSchema })],
      config: adminRateLimitConfig,
    },
    async (request) => {
      const { userId } = request.params as AdminUserParamsInput;
      return service.getEffectiveAccess(userId);
    },
  );

  fastify.get(
    "/api/admin/users/:userId/overrides",
    {
      preHandler: [
        ...adminPreHandlers,
        validate({ params: adminUserParamsSchema, query: overrideHistoryQuerySchema }),
      ],
      config: adminRateLimitConfig,
    },
    async (request) => {
      const { userId } = request.params as AdminUserParamsInput;
      const { limit } = request.query as OverrideHistoryQueryInput;
      return service.getOverrideHistory(userId, limit);
    },
  );
}
