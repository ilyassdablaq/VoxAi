import { FastifyInstance } from "fastify";
import { authenticate } from "../../common/middleware/auth-middleware.js";
import { validate } from "../../common/middleware/validate.js";
import { AppError } from "../../common/errors/app-error.js";
import { RagService } from "../../services/rag/rag.service.js";
import { KnowledgeService } from "./knowledge.service.js";
import {
  documentIdParamSchema,
  IngestFileInput,
  IngestStructuredInput,
  IngestUrlInput,
  ingestFileSchema,
  ingestStructuredSchema,
  ingestUrlSchema,
} from "./knowledge.schemas.js";

export async function knowledgeRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new KnowledgeService(new RagService());
  const allowedExtensions = [".pdf", ".txt", ".json", ".xml"];

  fastify.get("/api/knowledge/documents", { preHandler: [authenticate] }, async (request) => {
    const user = request.user as { sub: string };
    return service.listDocuments(user.sub);
  });

  fastify.post(
    "/api/knowledge/ingest/file",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as { sub: string };

      if (request.isMultipart()) {
        let filePart: any = null;
        let title = "";

        // Iterate through all parts to find file and fields
        for await (const part of request.parts()) {
          if (part.type === "file") {
            filePart = part;
          } else if (part.type === "field" && part.fieldname === "title") {
            title = (part.value as string)?.trim() || "";
          }
        }

        if (!filePart) {
          throw new AppError(400, "FILE_REQUIRED", "No file provided in multipart payload");
        }

        const fileBuffer = await filePart.toBuffer();
        const lowerName = filePart.filename.toLowerCase();
        const hasAllowedExtension = allowedExtensions.some((ext) => lowerName.endsWith(ext));

        if (!hasAllowedExtension) {
          throw new AppError(400, "UNSUPPORTED_FILE_TYPE", "Only PDF, TXT, JSON, and XML files are supported");
        }

        if (!fileBuffer.length) {
          throw new AppError(400, "EMPTY_FILE", "Uploaded file is empty");
        }

        const result = await service.ingestFileMultipart(user.sub, {
          fileName: title || filePart.filename,
          originalFileName: filePart.filename,
          mimeType: filePart.mimetype,
          buffer: fileBuffer,
        });

        return reply.status(201).send(result);
      }

      const parsedBody = ingestFileSchema.safeParse(request.body);
      if (!parsedBody.success) {
        throw new AppError(400, "VALIDATION_ERROR", "Either multipart file or valid JSON payload is required", parsedBody.error.flatten());
      }

      const result = await service.ingestFile(user.sub, parsedBody.data as IngestFileInput);
      return reply.status(201).send(result);
    },
  );

  fastify.post(
    "/api/knowledge/ingest/structured",
    { preHandler: [authenticate, validate({ body: ingestStructuredSchema })] },
    async (request, reply) => {
      const user = request.user as { sub: string };
      const result = await service.ingestStructured(user.sub, request.body as IngestStructuredInput);
      return reply.status(201).send(result);
    },
  );

  fastify.post(
    "/api/knowledge/ingest/url",
    { preHandler: [authenticate, validate({ body: ingestUrlSchema })] },
    async (request, reply) => {
      const user = request.user as { sub: string };
      const result = await service.ingestUrl(user.sub, request.body as IngestUrlInput);
      return reply.status(201).send(result);
    },
  );

  fastify.delete(
    "/api/knowledge/documents/:id",
    { preHandler: [authenticate, validate({ params: documentIdParamSchema })] },
    async (request, reply) => {
      const user = request.user as { sub: string };
      const { id } = request.params as { id: string };
      await service.deleteDocument(user.sub, id);
      return reply.status(204).send();
    },
  );
}
