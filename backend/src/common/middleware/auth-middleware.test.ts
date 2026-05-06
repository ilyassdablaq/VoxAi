import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "../errors/app-error";

const mockPrismaKey = {
  id: "key-1",
  userId: "user-1",
  isActive: true,
  user: { email: "user@example.com", role: "USER" as const },
};

vi.mock("../../infra/database/prisma.js", () => ({
  prisma: {
    aPIKey: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { prisma } from "../../infra/database/prisma";
import { authenticate, authenticateAny, authorize } from "./auth-middleware";

function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    cookies: {},
    headers: {},
    server: {
      jwt: {
        verify: vi.fn().mockResolvedValue({ sub: "jwt-user", email: "jwt@example.com", role: "USER" }),
      },
    },
    user: undefined,
    ...overrides,
  } as any;
}

describe("authenticate", () => {
  it("resolves via cookie JWT", async () => {
    const req = makeRequest({ cookies: { accessToken: "tok" } });
    await authenticate(req, {} as any);
    expect(req.server.jwt.verify).toHaveBeenCalledWith("tok");
    expect(req.user).toBeDefined();
  });

  it("resolves via Bearer header", async () => {
    const req = makeRequest({ headers: { authorization: "Bearer my-token" } });
    await authenticate(req, {} as any);
    expect(req.server.jwt.verify).toHaveBeenCalledWith("my-token");
  });

  it("throws UNAUTHORIZED when no token", async () => {
    const req = makeRequest();
    await expect(authenticate(req, {} as any)).rejects.toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED", statusCode: 401 }),
    );
  });

  it("throws UNAUTHORIZED on invalid JWT", async () => {
    const req = makeRequest({ cookies: { accessToken: "bad" } });
    req.server.jwt.verify.mockRejectedValueOnce(new Error("invalid"));
    await expect(authenticate(req, {} as any)).rejects.toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED" }),
    );
  });
});

describe("authenticateAny", () => {
  beforeEach(() => vi.clearAllMocks());

  it("prefers cookie JWT over API key", async () => {
    const req = makeRequest({
      cookies: { accessToken: "jwt-tok" },
      headers: { "x-api-key": "vox_apikey" },
    });
    await authenticateAny(req, {} as any);
    expect(req.server.jwt.verify).toHaveBeenCalledWith("jwt-tok");
    expect(vi.mocked(prisma.aPIKey.findUnique)).not.toHaveBeenCalled();
  });

  it("prefers Bearer JWT over API key", async () => {
    const req = makeRequest({ headers: { authorization: "Bearer bearer-tok", "x-api-key": "vox_apikey" } });
    await authenticateAny(req, {} as any);
    expect(req.server.jwt.verify).toHaveBeenCalledWith("bearer-tok");
    expect(vi.mocked(prisma.aPIKey.findUnique)).not.toHaveBeenCalled();
  });

  it("falls through to API key when no JWT present", async () => {
    vi.mocked(prisma.aPIKey.findUnique).mockResolvedValueOnce(mockPrismaKey as any);
    const req = makeRequest({ headers: { "x-api-key": "vox_abc123" } });
    await authenticateAny(req, {} as any);
    expect(vi.mocked(prisma.aPIKey.findUnique)).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ sub: "user-1", email: "user@example.com", type: "api_key" });
  });

  it("throws INVALID_API_KEY for unknown key", async () => {
    vi.mocked(prisma.aPIKey.findUnique).mockResolvedValueOnce(null);
    const req = makeRequest({ headers: { "x-api-key": "vox_unknown" } });
    await expect(authenticateAny(req, {} as any)).rejects.toThrow(
      expect.objectContaining({ code: "INVALID_API_KEY", statusCode: 401 }),
    );
  });

  it("throws INVALID_API_KEY for inactive key", async () => {
    vi.mocked(prisma.aPIKey.findUnique).mockResolvedValueOnce({ ...mockPrismaKey, isActive: false } as any);
    const req = makeRequest({ headers: { "x-api-key": "vox_inactive" } });
    await expect(authenticateAny(req, {} as any)).rejects.toThrow(
      expect.objectContaining({ code: "INVALID_API_KEY" }),
    );
  });

  it("throws UNAUTHORIZED when no credentials at all", async () => {
    const req = makeRequest();
    await expect(authenticateAny(req, {} as any)).rejects.toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED", statusCode: 401 }),
    );
  });

  it("throws UNAUTHORIZED when JWT is invalid (not falls through to api-key)", async () => {
    const req = makeRequest({ cookies: { accessToken: "bad-jwt" } });
    req.server.jwt.verify.mockRejectedValueOnce(new Error("expired"));
    await expect(authenticateAny(req, {} as any)).rejects.toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED" }),
    );
    expect(vi.mocked(prisma.aPIKey.findUnique)).not.toHaveBeenCalled();
  });
});

describe("authorize", () => {
  it("passes when user has required role", async () => {
    const req = makeRequest({ user: { role: "ADMIN" } });
    await expect(authorize(["ADMIN"])(req, {} as any)).resolves.toBeUndefined();
  });

  it("throws FORBIDDEN when role insufficient", async () => {
    const req = makeRequest({ user: { role: "USER" } });
    await expect(authorize(["ADMIN"])(req, {} as any)).rejects.toThrow(
      expect.objectContaining({ code: "FORBIDDEN", statusCode: 403 }),
    );
  });

  it("throws FORBIDDEN when no user", async () => {
    const req = makeRequest({ user: undefined });
    await expect(authorize(["USER"])(req, {} as any)).rejects.toThrow(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });
});
