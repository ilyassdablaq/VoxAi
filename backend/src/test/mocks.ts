import { vi } from "vitest";
import { PrismaClient } from "@prisma/client";

/**
 * Creates a mock Prisma client for testing
 */
export function createMockPrismaClient() {
  const prisma = {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
    },
    plan: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    refreshToken: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    conversation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    knowledgeDocument: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
    $disconnect: vi.fn(),
  } as unknown as PrismaClient;

  return prisma;
}

/**
 * Test fixtures for common data structures
 */
export const testFixtures = {
  user: {
    id: "user-123",
    email: "test@example.com",
    passwordHash: "$2b$10$hashedpassword123", // bcrypt hash of "Password123"
    fullName: "Test User",
    role: "USER" as const,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    passwordResetToken: null,
    passwordResetExpiresAt: null,
  },

  subscription: {
    id: "sub-123",
    userId: "user-123",
    planId: "plan-free",
    status: "ACTIVE" as const,
    startsAt: new Date("2024-01-01"),
    endsAt: null,
    stripeSubscriptionId: null,
    stripeCustomerId: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },

  plan: {
    id: "plan-free",
    key: "free",
    name: "Free",
    type: "FREE" as const,
    interval: "MONTHLY",
    priceCents: 0,
    voiceMinutes: 30,
    tokenLimit: 10000,
    features: ["30 voice minutes", "10,000 AI tokens", "basic_chat", "voice_synthesis"],
    stripeProductId: null,
    stripePriceId: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },

  proPlan: {
    id: "plan-pro",
    key: "pro",
    name: "Pro",
    type: "PRO" as const,
    interval: "MONTHLY",
    priceCents: 9900,
    voiceMinutes: 5000,
    tokenLimit: 100000,
    features: ["advanced_analytics", "priority_support"],
    stripeProductId: "prod_123",
    stripePriceId: "price_123",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },

  refreshToken: {
    tokenHash: "hashed_refresh_token_123",
    userId: "user-123",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    revokedAt: null,
    createdAt: new Date(),
  },
};

/**
 * Utility to create test request with fastify context
 */
export function createMockFastifyRequest(options: {
  body?: Record<string, unknown>;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  headers?: Record<string, unknown>;
  user?: { id: string; email: string };
}) {
  return {
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
    headers: {
      "content-type": "application/json",
      ...options.headers,
    },
    user: options.user,
  };
}

/**
 * Utility to create test reply
 */
export function createMockFastifyReply() {
  const reply = {
    code: vi.fn(function() { return this; }),
    send: vi.fn(function() { return this; }),
    redirect: vi.fn(function() { return this; }),
    header: vi.fn(function() { return this; }),
  };
  return reply;
}
