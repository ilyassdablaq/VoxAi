import { FastifyInstance } from "fastify";
import { PlanRepository } from "./plan.repository.js";
import { PlanService } from "./plan.service.js";
import { authenticate } from "../../common/middleware/auth-middleware.js";
import { validate } from "../../common/middleware/validate.js";
import { z } from "zod";

const changePlanSchema = z.object({
  planKey: z.string().min(1),
});

export async function planRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new PlanService(new PlanRepository());

  fastify.get("/api/plans", async () => {
    return service.listPlans();
  });

  fastify.post(
    "/api/subscriptions/change",
    { preHandler: [authenticate, validate({ body: changePlanSchema })] },
    async (request) => {
      const user = request.user as { sub: string };
      const { planKey } = request.body as { planKey: string };
      return service.changePlan(user.sub, planKey);
    },
  );
}
