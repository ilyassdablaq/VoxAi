import { FastifyInstance } from "fastify";
import { authenticate } from "../../common/middleware/auth-middleware.js";
import { validate } from "../../common/middleware/validate.js";
import {
  CreateWorkflowInput,
  RunWorkflowInput,
  UpdateWorkflowInput,
  createWorkflowSchema,
  runWorkflowSchema,
  updateWorkflowSchema,
  workflowIdParamSchema,
} from "./workflow.schemas.js";
import { WorkflowRepository } from "./workflow.repository.js";
import { WorkflowService } from "./workflow.service.js";

export async function workflowRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new WorkflowService(new WorkflowRepository());

  fastify.get("/api/workflows", { preHandler: [authenticate] }, async (request) => {
    const user = request.user as { sub: string };
    return service.listWorkflows(user.sub);
  });

  fastify.post(
    "/api/workflows",
    { preHandler: [authenticate, validate({ body: createWorkflowSchema })] },
    async (request, reply) => {
      const user = request.user as { sub: string };
      const workflow = await service.createWorkflow(user.sub, request.body as CreateWorkflowInput);
      return reply.status(201).send(workflow);
    },
  );

  fastify.patch(
    "/api/workflows/:id",
    { preHandler: [authenticate, validate({ params: workflowIdParamSchema, body: updateWorkflowSchema })] },
    async (request) => {
      const user = request.user as { sub: string };
      const { id } = request.params as { id: string };
      return service.updateWorkflow(user.sub, id, request.body as UpdateWorkflowInput);
    },
  );

  fastify.delete(
    "/api/workflows/:id",
    { preHandler: [authenticate, validate({ params: workflowIdParamSchema })] },
    async (request, reply) => {
      const user = request.user as { sub: string };
      const { id } = request.params as { id: string };
      await service.deleteWorkflow(user.sub, id);
      return reply.status(204).send();
    },
  );

  fastify.post(
    "/api/workflows/:id/run",
    { preHandler: [authenticate, validate({ params: workflowIdParamSchema, body: runWorkflowSchema })] },
    async (request) => {
      const user = request.user as { sub: string };
      const { id } = request.params as { id: string };
      return service.runWorkflow(user.sub, id, request.body as RunWorkflowInput);
    },
  );

  fastify.get("/api/workflows/runs", { preHandler: [authenticate] }, async (request) => {
    const user = request.user as { sub: string };
    const workflowId = (request.query as { workflowId?: string }).workflowId;
    return service.listRuns(user.sub, workflowId);
  });
}
