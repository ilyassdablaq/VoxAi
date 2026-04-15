import { FastifyInstance } from "fastify";
import { authenticate } from "../../common/middleware/auth-middleware.js";
import { validate } from "../../common/middleware/validate.js";
import { AppError } from "../../common/errors/app-error.js";
import { logger } from "../../config/logger.js";
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
  const allowedMimeTypes = new Set(["application/pdf", "text/plain", "application/json", "application/xml", "text/xml"]);

  fastify.get("/api/knowledge/documents", { preHandler: [authenticate] }, async (request) => {
    const user = request.user as { sub: string };
    return service.listDocuments(user.sub);
  });

  fastify.post(
    "/api/knowledge/ingest/file",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as { sub: string };
      logger.info({ userId: user.sub, isMultipart: request.isMultipart() }, "Knowledge file ingest request received");

      if (request.isMultipart()) {
        let fileBuffer: Buffer | null = null;
        let filename = "";
        let mimetype = "";
        let title = "";

        // Iterate through all parts to find file and fields
        for await (const part of request.parts()) {
          if (part.type === "file") {
            filename = part.filename;
            mimetype = part.mimetype;
            fileBuffer = await part.toBuffer();
          } else if (part.type === "field" && part.fieldname === "title") {
            title = (part.value as string)?.trim() || "";
          }
        }

        if (!fileBuffer) {
          throw new AppError(400, "FILE_REQUIRED", "No file provided in multipart payload");
        }

        const lowerName = filename.toLowerCase();
        const hasAllowedExtension = allowedExtensions.some((ext) => lowerName.endsWith(ext));

        if (!hasAllowedExtension) {
          throw new AppError(400, "UNSUPPORTED_FILE_TYPE", "Only PDF, TXT, JSON, and XML files are supported");
        }

        if (!allowedMimeTypes.has(mimetype.toLowerCase())) {
          throw new AppError(400, "UNSUPPORTED_FILE_TYPE", "Uploaded file MIME type is not allowed");
        }

        if (!fileBuffer.length) {
          throw new AppError(400, "EMPTY_FILE", "Uploaded file is empty");
        }

        logger.info(
          { userId: user.sub, filename, mimetype, fileSize: fileBuffer.length, hasTitle: Boolean(title) },
          "Knowledge file parsed from multipart",
        );

        const result = await service.ingestFileMultipart(user.sub, {
          fileName: title || filename,
          originalFileName: filename,
          mimeType: mimetype,
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
