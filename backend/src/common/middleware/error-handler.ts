import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../errors/app-error.js";
import { logger } from "../../config/logger.js";
import { Sentry } from "../../config/sentry.js";

export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply): void {
  if (error instanceof ZodError) {
    reply.status(400).send({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: error.flatten(),
      },
    });
    return;
  }

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      Sentry.captureException(error, {
        tags: {
          scope: "api",
          statusCode: String(error.statusCode),
          method: request.method,
        },
        extra: {
          url: request.url,
          code: error.code,
        },
      });
    }

    reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  Sentry.captureException(error, {
    tags: {
      scope: "api",
      statusCode: "500",
      method: request.method,
    },
    extra: {
      url: request.url,
    },
  });

  logger.error({ error }, "Unhandled server error");

  reply.status(500).send({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong",
    },
  });
}
