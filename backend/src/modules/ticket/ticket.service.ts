import { randomUUID } from "node:crypto";
import { AppError } from "../../common/errors/app-error.js";
import { CreatePublicTicketInput, CreateTicketInput, UpdateTicketInput } from "./ticket.schemas.js";
import { TicketRepository } from "./ticket.repository.js";

export class TicketService {
  constructor(private readonly repository: TicketRepository) {}

  async listTickets(userId: string) {
    return this.repository.listByUser(userId);
  }

  async createTicket(userId: string, payload: CreateTicketInput) {
    return this.repository.create({
      id: randomUUID(),
      userId,
      subject: payload.subject,
      description: payload.description,
      category: payload.category,
      priority: payload.priority,
    });
  }

  async updateTicket(userId: string, id: string, payload: UpdateTicketInput) {
    const existing = await this.repository.getById(userId, id);
    if (!existing) {
      throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
    }

    return this.repository.update({
      id,
      userId,
      subject: payload.subject ?? existing.subject,
      description: payload.description ?? existing.description,
      category: payload.category ?? existing.category,
      priority: payload.priority ?? existing.priority,
      status: payload.status ?? existing.status,
    });
  }

  async deleteTicket(userId: string, id: string) {
    const deletedRows = await this.repository.delete(userId, id);
    if (deletedRows === 0) {
      throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
    }
  }

  async createPublicTicket(ownerUserId: string, payload: CreatePublicTicketInput) {
    return this.repository.create({
      id: randomUUID(),
      userId: ownerUserId,
      subject: payload.subject,
      description: payload.description,
      category: payload.category,
      priority: "MEDIUM",
      source: "WIDGET",
      visitorName: payload.visitorName,
      visitorEmail: payload.visitorEmail,
    });
  }
}
