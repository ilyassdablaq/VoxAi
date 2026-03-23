import { FastifyInstance } from "fastify";
import { authenticate } from "../../common/middleware/auth-middleware.js";
import { validate } from "../../common/middleware/validate.js";
import { VoiceRepository } from "./voice.repository.js";
import { VoiceSettingsInput, voiceSettingsSchema } from "./voice.schemas.js";
import { VoiceService } from "./voice.service.js";

export async function voiceRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new VoiceService(new VoiceRepository());

  fastify.get("/api/voice/settings", { preHandler: [authenticate] }, async (request) => {
    const user = request.user as { sub: string };
    return service.getSettings(user.sub);
  });

  fastify.put(
    "/api/voice/settings",
    { preHandler: [authenticate, validate({ body: voiceSettingsSchema })] },
    async (request) => {
      const user = request.user as { sub: string };
      return service.updateSettings(user.sub, request.body as VoiceSettingsInput);
    },
  );

  fastify.get("/api/voice/options", { preHandler: [authenticate] }, async () => {
    return service.getAvailableVoices();
  });
}
