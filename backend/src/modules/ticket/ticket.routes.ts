import { FastifyInstance } from "fastify";
import { authenticate } from "../../common/middleware/auth-middleware.js";
import { validate } from "../../common/middleware/validate.js";
import {
  CreateTicketInput,
  UpdateTicketInput,
  createTicketSchema,
  ticketIdParamSchema,
  updateTicketSchema,
} from "./ticket.schemas.js";
import { TicketRepository } from "./ticket.repository.js";
import { TicketService } from "./ticket.service.js";

export async function ticketRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new TicketService(new TicketRepository());

  fastify.get("/api/tickets", { preHandler: [authenticate] }, async (request) => {
    const user = request.user as { sub: string };
    return service.listTickets(user.sub);
  });

  fastify.post(
    "/api/tickets",
    { preHandler: [authenticate, validate({ body: createTicketSchema })] },
    async (request, reply) => {
      const user = request.user as { sub: string };
      const ticket = await service.createTicket(user.sub, request.body as CreateTicketInput);
      return reply.status(201).send(ticket);
    },
  );

  fastify.patch(
    "/api/tickets/:id",
    { preHandler: [authenticate, validate({ params: ticketIdParamSchema, body: updateTicketSchema })] },
    async (request) => {
      const user = request.user as { sub: string };
      const { id } = request.params as { id: string };
      return service.updateTicket(user.sub, id, request.body as UpdateTicketInput);
    },
  );

  fastify.delete(
    "/api/tickets/:id",
    { preHandler: [authenticate, validate({ params: ticketIdParamSchema })] },
    async (request, reply) => {
      const user = request.user as { sub: string };
      const { id } = request.params as { id: string };
      await service.deleteTicket(user.sub, id);
      return reply.status(204).send();
    },
  );
}
