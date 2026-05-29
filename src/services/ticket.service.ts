import { apiClient } from "@/lib/api-client";

export type TicketCategory = "technical" | "billing" | "account" | "voice_quality" | "integration" | "other";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export type TicketSource = "DASHBOARD" | "WIDGET";

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  source: TicketSource;
  visitorName: string | null;
  visitorEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketPayload {
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
}

export interface UpdateTicketPayload {
  subject?: string;
  description?: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  status?: TicketStatus;
}

export const ticketService = {
  listTickets(): Promise<SupportTicket[]> {
    return apiClient.get<SupportTicket[]>("/api/tickets");
  },

  createTicket(payload: CreateTicketPayload): Promise<SupportTicket> {
    return apiClient.post<SupportTicket>("/api/tickets", payload as unknown as Record<string, unknown>);
  },

  updateTicket(id: string, payload: UpdateTicketPayload): Promise<SupportTicket> {
    return apiClient.patch<SupportTicket>(`/api/tickets/${id}`, payload as Record<string, unknown>);
  },

  deleteTicket(id: string): Promise<void> {
    return apiClient.delete<void>(`/api/tickets/${id}`);
  },
};
