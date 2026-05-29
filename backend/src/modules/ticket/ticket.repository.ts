import { prisma } from "../../infra/database/prisma.js";
import type { TicketCategory, TicketPriority, TicketStatus } from "./ticket.schemas.js";

export type TicketRecord = {
  id: string;
  userId: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  source: "DASHBOARD" | "WIDGET";
  visitorName: string | null;
  visitorEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type TicketRow = {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  source: "DASHBOARD" | "WIDGET";
  visitor_name: string | null;
  visitor_email: string | null;
  created_at: Date;
  updated_at: Date;
};

function mapRow(row: TicketRow): TicketRecord {
  return {
    id: row.id,
    userId: row.user_id,
    subject: row.subject,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    source: row.source ?? "DASHBOARD",
    visitorName: row.visitor_name ?? null,
    visitorEmail: row.visitor_email ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class TicketRepository {
  private initialized = false;

  private async ensureTables() {
    if (this.initialized) {
      return;
    }

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'technical',
        priority TEXT NOT NULL DEFAULT 'MEDIUM',
        status TEXT NOT NULL DEFAULT 'OPEN',
        source TEXT NOT NULL DEFAULT 'DASHBOARD',
        visitor_name TEXT,
        visitor_email TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'DASHBOARD'
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS visitor_name TEXT
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS visitor_email TEXT
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS support_tickets_user_id_created_at_idx
      ON support_tickets(user_id, created_at DESC)
    `);

    this.initialized = true;
  }

  async listByUser(userId: string): Promise<TicketRecord[]> {
    await this.ensureTables();

    const rows = await prisma.$queryRawUnsafe<TicketRow[]>(
      `
      SELECT id, user_id, subject, description, category, priority, status, source, visitor_name, visitor_email, created_at, updated_at
      FROM support_tickets
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100
      `,
      userId,
    );

    return rows.map(mapRow);
  }

  async getById(userId: string, id: string): Promise<TicketRecord | null> {
    await this.ensureTables();

    const rows = await prisma.$queryRawUnsafe<TicketRow[]>(
      `
      SELECT id, user_id, subject, description, category, priority, status, source, visitor_name, visitor_email, created_at, updated_at
      FROM support_tickets
      WHERE user_id = $1 AND id = $2
      LIMIT 1
      `,
      userId,
      id,
    );

    const row = rows[0];
    return row ? mapRow(row) : null;
  }

  async create(input: {
    id: string;
    userId: string;
    subject: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
    source?: "DASHBOARD" | "WIDGET";
    visitorName?: string | null;
    visitorEmail?: string | null;
  }): Promise<TicketRecord> {
    await this.ensureTables();

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO support_tickets (id, user_id, subject, description, category, priority, status, source, visitor_name, visitor_email, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'OPEN', $7, $8, $9, NOW(), NOW())
      `,
      input.id,
      input.userId,
      input.subject,
      input.description,
      input.category,
      input.priority,
      input.source ?? "DASHBOARD",
      input.visitorName ?? null,
      input.visitorEmail ?? null,
    );

    const created = await this.getById(input.userId, input.id);
    if (!created) {
      throw new Error("Failed to create ticket");
    }
    return created;
  }

  async update(input: {
    id: string;
    userId: string;
    subject: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
    status: TicketStatus;
  }): Promise<TicketRecord> {
    await this.ensureTables();

    await prisma.$executeRawUnsafe(
      `
      UPDATE support_tickets
      SET subject = $3,
          description = $4,
          category = $5,
          priority = $6,
          status = $7,
          updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      `,
      input.id,
      input.userId,
      input.subject,
      input.description,
      input.category,
      input.priority,
      input.status,
    );

    const updated = await this.getById(input.userId, input.id);
    if (!updated) {
      throw new Error("Failed to update ticket");
    }
    return updated;
  }

  async delete(userId: string, id: string): Promise<number> {
    await this.ensureTables();

    const result = await prisma.$executeRawUnsafe(
      `
      DELETE FROM support_tickets
      WHERE id = $1 AND user_id = $2
      `,
      id,
      userId,
    );

    return Number(result ?? 0);
  }
}
