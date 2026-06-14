import { FastifyInstance } from "fastify";
import { authenticateAny } from "../../common/middleware/auth-middleware.js";
import { validate } from "../../common/middleware/validate.js";
import { RagService } from "../../services/rag/rag.service.js";
import { AiOrchestratorService } from "../../services/ai/ai-orchestrator.service.js";
import { ConversationRepository } from "../conversation/conversation.repository.js";
import { PublicApiService } from "./public-api.service.js";
import { ApiChatInput, apiChatSchema } from "./public-api.schemas.js";

/**
 * Versioned public API for developer API keys. Authenticated via `authenticateAny`
 * (x-api-key / Bearer JWT / cookie), so a generated `vox_…` key actually grants
 * access here.
 */
export async function publicApiRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new PublicApiService(
    new ConversationRepository(),
    new AiOrchestratorService(new RagService()),
  );

  fastify.post(
    "/api/v1/chat",
    { preHandler: [authenticateAny, validate({ body: apiChatSchema })] },
    async (request) => {
      const user = request.user as { sub: string };
      return service.chat(user.sub, request.body as ApiChatInput);
    },
  );
}
