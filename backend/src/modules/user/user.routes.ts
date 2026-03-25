import { FastifyInstance } from "fastify";
import { authenticate } from "../../common/middleware/auth-middleware.js";
import { UserRepository } from "./user.repository.js";
import { UserService } from "./user.service.js";

export async function userRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new UserService(new UserRepository());

  fastify.get(
    "/api/users/me",
    { preHandler: [authenticate] },
    async (request) => {
      const user = request.user as { sub: string };
      return service.getProfile(user.sub);
    },
  );

  fastify.delete(
    "/api/users/me",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as { sub: string };
      await service.deleteAccount(user.sub);
      return reply.status(204).send();
    },
  );
}
