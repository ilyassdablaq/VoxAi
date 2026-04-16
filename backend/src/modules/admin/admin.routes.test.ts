import Fastify from "fastify";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSearchUsers = vi.fn();
const mockSetSubscriptionOverride = vi.fn();
const mockRemoveSubscriptionOverride = vi.fn();
const mockGetEffectiveAccess = vi.fn();
const mockGetOverrideHistory = vi.fn();
const mockGetAuditLogs = vi.fn();

vi.mock("./admin.service.js", () => ({
  AdminService: vi.fn().mockImplementation(() => ({
    searchUsers: mockSearchUsers,
    setSubscriptionOverride: mockSetSubscriptionOverride,
    removeSubscriptionOverride: mockRemoveSubscriptionOverride,
    getEffectiveAccess: mockGetEffectiveAccess,
    getOverrideHistory: mockGetOverrideHistory,
    getAuditLogs: mockGetAuditLogs,
  })),
}));

import { adminRoutes } from "./admin.routes";

describe("Admin routes access control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows ADMIN to override subscription", async () => {
    const app = Fastify();
    await app.register(cookie);
    await app.register(jwt, { secret: "test-secret-123456789" });
    await app.register(adminRoutes);

    mockSetSubscriptionOverride.mockResolvedValue({
      userId: "target-user",
      plan: "PRO",
    });

    const adminToken = app.jwt.sign({ sub: "admin-1", role: "ADMIN" });

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/users/target-user/subscription/override",
      headers: {
        cookie: `accessToken=${adminToken}`,
      },
      payload: {
        plan: "PRO",
        reason: "QA",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockSetSubscriptionOverride).toHaveBeenCalledWith(
      "admin-1",
      "target-user",
      expect.objectContaining({ plan: "PRO" }),
      expect.any(Object),
    );

    await app.close();
  });

  it("returns 403 for non-admin users", async () => {
    const app = Fastify();
    await app.register(cookie);
    await app.register(jwt, { secret: "test-secret-123456789" });
    await app.register(adminRoutes);

    const userToken = app.jwt.sign({ sub: "user-1", role: "USER" });

    const response = await app.inject({
      method: "GET",
      url: "/api/admin/users/search?q=test",
      headers: {
        cookie: `accessToken=${userToken}`,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(mockSearchUsers).not.toHaveBeenCalled();

    await app.close();
  });

  it("allows ADMIN to remove subscription override", async () => {
    const app = Fastify();
    await app.register(cookie);
    await app.register(jwt, { secret: "test-secret-123456789" });
    await app.register(adminRoutes);

    mockRemoveSubscriptionOverride.mockResolvedValue(undefined);

    const adminToken = app.jwt.sign({ sub: "admin-1", role: "ADMIN" });

    const response = await app.inject({
      method: "DELETE",
      url: "/api/admin/users/target-user/subscription/override",
      headers: {
        cookie: `accessToken=${adminToken}`,
      },
    });

    expect(response.statusCode).toBe(204);
    expect(mockRemoveSubscriptionOverride).toHaveBeenCalledWith(
      "admin-1",
      "target-user",
      expect.any(Object),
    );

    await app.close();
  });

  it("returns override history for ADMIN", async () => {
    const app = Fastify();
    await app.register(cookie);
    await app.register(jwt, { secret: "test-secret-123456789" });
    await app.register(adminRoutes);

    mockGetOverrideHistory.mockResolvedValue([
      {
        plan: "PRO",
        reason: "QA",
        expiresAt: null,
        createdAt: "2026-04-12T00:00:00.000Z",
        revokedAt: null,
        createdByAdmin: {
          email: "admin@example.com",
          fullName: "Admin User",
        },
      },
    ]);

    const adminToken = app.jwt.sign({ sub: "admin-1", role: "ADMIN" });

    const response = await app.inject({
      method: "GET",
      url: "/api/admin/users/target-user/overrides?limit=5",
      headers: {
        cookie: `accessToken=${adminToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetOverrideHistory).toHaveBeenCalledWith("target-user", 5);

    await app.close();
  });
});
