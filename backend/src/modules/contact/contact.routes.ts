import { FastifyInstance } from "fastify";
import { authenticate, authorize } from "../../common/middleware/auth-middleware.js";
import { validate } from "../../common/middleware/validate.js";
import { ContactService } from "./contact.service.js";
import { ContactRepository } from "./contact.repository.js";
import { ContactInput, contactSchema } from "./contact.schemas.js";
import { emailService } from "../../services/email/email.service.js";

export async function contactRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new ContactService(new ContactRepository());

  fastify.post("/api/contact", { preHandler: [validate({ body: contactSchema })] }, async (request, reply) => {
    const authHeader = request.headers.authorization;
    let userId: string | undefined;

    if (authHeader) {
      try {
        await authenticate(request, reply);
        userId = (request.user as { sub: string }).sub;
      } catch {
        userId = undefined;
      }
    }

    const result = await service.create(request.body as ContactInput, userId);
    return reply.status(201).send(result);
  });

  fastify.post(
    "/api/contact/test-email",
    { preHandler: [authenticate, authorize(["ADMIN"])] },
    async (request, reply) => {
      const user = request.user as { email?: string; sub?: string } | undefined;
      const providerMessageId = await emailService.sendIntegrationTestEmail({
        triggeredBy: user?.email ?? user?.sub ?? "unknown",
      });

      return reply.status(200).send({
        ok: true,
        providerMessageId,
      });
    },
  );
}
