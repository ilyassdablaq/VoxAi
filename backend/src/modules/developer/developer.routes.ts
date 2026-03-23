import { FastifyInstance } from "fastify";
import { authenticate } from "../../common/middleware/auth-middleware.js";
import { validate } from "../../common/middleware/validate.js";
import { CreateApiKeyInput, apiKeyIdParamSchema, createApiKeySchema } from "./developer.schemas.js";
import { DeveloperService } from "./developer.service.js";

export async function developerRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new DeveloperService();

  fastify.get("/api/developer/keys", { preHandler: [authenticate] }, async (request) => {
    const user = request.user as { sub: string };
    return service.listApiKeys(user.sub);
  });

  fastify.post(
    "/api/developer/keys",
    { preHandler: [authenticate, validate({ body: createApiKeySchema })] },
    async (request, reply) => {
      const user = request.user as { sub: string };
      const created = await service.createApiKey(user.sub, request.body as CreateApiKeyInput);
      return reply.status(201).send(created);
    },
  );

  fastify.delete(
    "/api/developer/keys/:id",
    { preHandler: [authenticate, validate({ params: apiKeyIdParamSchema })] },
    async (request, reply) => {
      const user = request.user as { sub: string };
      const { id } = request.params as { id: string };
      await service.deactivateApiKey(user.sub, id);
      return reply.status(204).send();
    },
  );

  fastify.get("/api/developer/snippets", { preHandler: [authenticate] }, async () => {
    return service.getSdkSnippets();
  });
}
