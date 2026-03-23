import { prisma } from "../../infra/database/prisma.js";

export type WorkflowRecord = {
  id: string;
  userId: string;
  name: string;
  description: string;
  isActive: boolean;
  trigger: {
    type: string;
    config: Record<string, unknown>;
  };
  actions: Array<{
    type: string;
    config: Record<string, unknown>;
  }>;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkflowRunRecord = {
  id: string;
  workflowId: string;
  userId: string;
  status: "SUCCESS" | "FAILED";
  output: Record<string, unknown>;
  createdAt: Date;
};

export class WorkflowRepository {
  private initialized = false;

  private async ensureTables() {
    if (this.initialized) {
      return;
    }

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS workflow_automations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        trigger JSONB NOT NULL,
        actions JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS workflow_runs (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL,
        output JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT workflow_runs_workflow_id_fk FOREIGN KEY (workflow_id) REFERENCES workflow_automations(id) ON DELETE CASCADE
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS workflow_automations_user_id_idx ON workflow_automations(user_id)
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS workflow_runs_user_id_created_at_idx ON workflow_runs(user_id, created_at DESC)
    `);

    this.initialized = true;
  }

  async listByUser(userId: string): Promise<WorkflowRecord[]> {
    await this.ensureTables();

    const rows = await prisma.$queryRawUnsafe<Array<{
      id: string;
      user_id: string;
      name: string;
      description: string;
      is_active: boolean;
      trigger: WorkflowRecord["trigger"];
      actions: WorkflowRecord["actions"];
      created_at: Date;
      updated_at: Date;
    }>>(
      `
      SELECT id, user_id, name, description, is_active, trigger, actions, created_at, updated_at
      FROM workflow_automations
      WHERE user_id = $1
      ORDER BY updated_at DESC
      `,
      userId,
    );

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      isActive: row.is_active,
      trigger: row.trigger,
      actions: row.actions,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getById(userId: string, id: string): Promise<WorkflowRecord | null> {
    await this.ensureTables();

    const rows = await prisma.$queryRawUnsafe<Array<{
      id: string;
      user_id: string;
      name: string;
      description: string;
      is_active: boolean;
      trigger: WorkflowRecord["trigger"];
      actions: WorkflowRecord["actions"];
      created_at: Date;
      updated_at: Date;
    }>>(
      `
      SELECT id, user_id, name, description, is_active, trigger, actions, created_at, updated_at
      FROM workflow_automations
      WHERE user_id = $1 AND id = $2
      LIMIT 1
      `,
      userId,
      id,
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      isActive: row.is_active,
      trigger: row.trigger,
      actions: row.actions,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async create(input: {
    id: string;
    userId: string;
    name: string;
    description: string;
    isActive: boolean;
    trigger: WorkflowRecord["trigger"];
    actions: WorkflowRecord["actions"];
  }): Promise<WorkflowRecord> {
    await this.ensureTables();

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO workflow_automations (id, user_id, name, description, is_active, trigger, actions, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, NOW(), NOW())
      `,
      input.id,
      input.userId,
      input.name,
      input.description,
      input.isActive,
      JSON.stringify(input.trigger),
      JSON.stringify(input.actions),
    );

    const created = await this.getById(input.userId, input.id);
    if (!created) {
      throw new Error("Failed to create workflow");
    }
    return created;
  }

  async update(input: {
    id: string;
    userId: string;
    name: string;
    description: string;
    isActive: boolean;
    trigger: WorkflowRecord["trigger"];
    actions: WorkflowRecord["actions"];
  }): Promise<WorkflowRecord> {
    await this.ensureTables();

    await prisma.$executeRawUnsafe(
      `
      UPDATE workflow_automations
      SET name = $3,
          description = $4,
          is_active = $5,
          trigger = $6::jsonb,
          actions = $7::jsonb,
          updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      `,
      input.id,
      input.userId,
      input.name,
      input.description,
      input.isActive,
      JSON.stringify(input.trigger),
      JSON.stringify(input.actions),
    );

    const updated = await this.getById(input.userId, input.id);
    if (!updated) {
      throw new Error("Failed to update workflow");
    }
    return updated;
  }

  async delete(userId: string, id: string): Promise<number> {
    await this.ensureTables();

    const result = await prisma.$executeRawUnsafe(
      `
      DELETE FROM workflow_automations
      WHERE id = $1 AND user_id = $2
      `,
      id,
      userId,
    );

    return Number(result ?? 0);
  }

  async createRun(input: {
    id: string;
    workflowId: string;
    userId: string;
    status: "SUCCESS" | "FAILED";
    output: Record<string, unknown>;
  }): Promise<void> {
    await this.ensureTables();

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO workflow_runs (id, workflow_id, user_id, status, output, created_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
      `,
      input.id,
      input.workflowId,
      input.userId,
      input.status,
      JSON.stringify(input.output),
    );
  }

  async listRuns(userId: string, workflowId?: string): Promise<WorkflowRunRecord[]> {
    await this.ensureTables();

    const rows = await prisma.$queryRawUnsafe<Array<{
      id: string;
      workflow_id: string;
      user_id: string;
      status: "SUCCESS" | "FAILED";
      output: Record<string, unknown>;
      created_at: Date;
    }>>(
      workflowId
        ? `
          SELECT id, workflow_id, user_id, status, output, created_at
          FROM workflow_runs
          WHERE user_id = $1 AND workflow_id = $2
          ORDER BY created_at DESC
          LIMIT 50
        `
        : `
          SELECT id, workflow_id, user_id, status, output, created_at
          FROM workflow_runs
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 50
        `,
      ...(workflowId ? [userId, workflowId] : [userId]),
    );

    return rows.map((row) => ({
      id: row.id,
      workflowId: row.workflow_id,
      userId: row.user_id,
      status: row.status,
      output: row.output,
      createdAt: row.created_at,
    }));
  }
}
