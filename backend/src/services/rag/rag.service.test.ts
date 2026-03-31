import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../common/errors/app-error";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    $queryRawUnsafe: vi.fn(),
    $transaction: vi.fn(),
    knowledgeDocument: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("../../config/env.js", () => ({
  env: {
    OPENAI_API_KEY: "",
  },
}));

vi.mock("../../config/logger.js", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../infra/database/prisma.js", () => ({
  prisma: mockPrisma,
}));

import { RagService } from "./rag.service";

describe("RagService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$queryRawUnsafe.mockReset();
    mockPrisma.$transaction.mockReset();
    mockPrisma.knowledgeDocument.findMany.mockReset();
    mockPrisma.knowledgeDocument.deleteMany.mockReset();
  });

  it("retrieves top-k contexts for a user and passes tenant filter in SQL args", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      { chunk_text: "Doc 1 context" },
      { chunk_text: "Doc 2 context" },
    ]);

    const service = new RagService();
    const contexts = await service.retrieveContext("user-a", "How do refunds work?", 2);

    expect(contexts).toEqual(["Doc 1 context", "Doc 2 context"]);
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    const [sql, userIdArg, vectorArg, topKArg] = mockPrisma.$queryRawUnsafe.mock.calls[0] as [
      string,
      string,
      string,
      number,
    ];
    expect(sql).toContain('WHERE kd."userId" = $1');
    expect(userIdArg).toBe("user-a");
    expect(typeof vectorArg).toBe("string");
    expect(vectorArg.startsWith("[")).toBe(true);
    expect(topKArg).toBe(2);
  });

  it("uses retrieval cache for same user, normalized query, and top-k", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([{ chunk_text: "Cached context" }]);

    const service = new RagService();
    const first = await service.retrieveContext("user-cache", "   Billing Limits   ", 3);
    const second = await service.retrieveContext("user-cache", "billing limits", 3);

    expect(first).toEqual(["Cached context"]);
    expect(second).toEqual(["Cached context"]);
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
  });

  it("does not share retrieval cache across tenants", async () => {
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ chunk_text: "Tenant A" }])
      .mockResolvedValueOnce([{ chunk_text: "Tenant B" }]);

    const service = new RagService();
    const a = await service.retrieveContext("tenant-a", "same question", 2);
    const b = await service.retrieveContext("tenant-b", "same question", 2);

    expect(a).toEqual(["Tenant A"]);
    expect(b).toEqual(["Tenant B"]);
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(2);
  });

  it("builds prompt with explicit no-context fallback", () => {
    const service = new RagService();
    const prompt = service.buildPrompt("What is VoxFlow?", []);

    expect(prompt).toContain("Context:\nNo relevant context found.");
    expect(prompt).toContain("User:\nWhat is VoxFlow?");
  });

  it("builds prompt by concatenating retrieved context chunks", () => {
    const service = new RagService();
    const prompt = service.buildPrompt("Summarize", ["Fact A", "Fact B"]);

    expect(prompt).toContain("Context:\nFact A\n\nFact B");
  });

  it("rejects empty base64 uploads", async () => {
    const service = new RagService();

    await expect(
      service.ingestFromUpload({
        userId: "user-1",
        fileName: "empty.txt",
        mimeType: "text/plain",
        contentBase64: "",
      }),
    ).rejects.toThrow(
      expect.objectContaining({
        statusCode: 400,
        code: "EMPTY_FILE",
      }),
    );
  });

  it("rejects invalid JSON structured input", async () => {
    const service = new RagService();

    await expect(
      service.ingestStructuredData({
        userId: "user-1",
        format: "json",
        title: "broken.json",
        content: "{ invalid",
      }),
    ).rejects.toThrow(
      expect.objectContaining({
        statusCode: 400,
        code: "STRUCTURED_PARSE_FAILED",
      }),
    );
  });

  it("invalidates retrieval cache for user after successful document deletion", async () => {
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ chunk_text: "Before delete" }])
      .mockResolvedValueOnce([{ chunk_text: "After delete" }]);
    mockPrisma.knowledgeDocument.deleteMany.mockResolvedValue({ count: 1 });

    const service = new RagService();
    const beforeDelete = await service.retrieveContext("user-delete", "question", 1);
    await service.deleteDocument("user-delete", "doc-1");
    const afterDelete = await service.retrieveContext("user-delete", "question", 1);

    expect(beforeDelete).toEqual(["Before delete"]);
    expect(afterDelete).toEqual(["After delete"]);
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(2);
  });

  it("throws DOCUMENT_NOT_FOUND when deleteDocument cannot delete tenant-owned document", async () => {
    mockPrisma.knowledgeDocument.deleteMany.mockResolvedValue({ count: 0 });
    const service = new RagService();

    await expect(service.deleteDocument("user-x", "missing-doc")).rejects.toThrow(
      expect.objectContaining({
        statusCode: 404,
        code: "DOCUMENT_NOT_FOUND",
      }),
    );
  });

  it("wraps storage-layer failures during structured ingest", async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error("db down"));
    const service = new RagService();

    await expect(
      service.ingestStructuredData({
        userId: "user-2",
        format: "json",
        title: "doc.json",
        content: JSON.stringify({ faq: [{ q: "q1", a: "a1" }] }),
      }),
    ).rejects.toThrow(
      expect.objectContaining({
        statusCode: 500,
        code: "CHUNK_STORE_FAILED",
      }),
    );
  });

  it("keeps AppError unchanged when storage path throws AppError", async () => {
    const storageError = new AppError(413, "TOO_LARGE", "Too large");
    mockPrisma.$transaction.mockRejectedValue(storageError);
    const service = new RagService();

    await expect(
      service.ingestStructuredData({
        userId: "user-3",
        format: "json",
        title: "doc.json",
        content: JSON.stringify({ items: ["alpha"] }),
      }),
    ).rejects.toThrow(
      expect.objectContaining({
        statusCode: 413,
        code: "TOO_LARGE",
      }),
    );
  });
});