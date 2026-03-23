import { FastifyInstance } from "fastify";
import { authenticate } from "../../common/middleware/auth-middleware.js";
import { validate } from "../../common/middleware/validate.js";
import { AnalyticsQueryInput, analyticsQuerySchema } from "./analytics.schemas.js";
import { AnalyticsService } from "./analytics.service.js";

export async function analyticsRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new AnalyticsService();

  fastify.get(
    "/api/analytics/dashboard",
    { preHandler: [authenticate, validate({ query: analyticsQuerySchema })] },
    async (request) => {
      const user = request.user as { sub: string };
      return service.getDashboardAnalytics(user.sub, request.query as AnalyticsQueryInput);
    },
  );
}
