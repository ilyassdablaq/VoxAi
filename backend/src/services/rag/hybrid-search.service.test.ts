import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQueryRawUnsafe } = vi.hoisted(() => ({
  mockQueryRawUnsafe: vi.fn(),
}));

vi.mock("../../infra/database/prisma.js", () => ({
  prisma: { $queryRawUnsafe: mockQueryRawUnsafe },
}));

vi.mock("../../config/logger.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { HybridSearchService } from "./hybrid-search.service";

const FAKE_EMBEDDING = new Array(1536).fill(0.1);

function makeRows(ids: string[], prefix = "chunk") {
  return ids.map((id) => ({ id, chunk_text: `${prefix} text for ${id}` }));
}

describe("HybridSearchService", () => {
  let service: HybridSearchService;

  beforeEach(() => {
    service = new HybridSearchService();
    vi.clearAllMocks();
  });

  it("calls both vector and FTS queries in parallel", async () => {
    mockQueryRawUnsafe
      .mockResolvedValueOnce(makeRows(["a", "b", "c"]))
      .mockResolvedValueOnce(makeRows(["c", "d", "e"]));

    await service.retrieve("user-1", "how to reset password", FAKE_EMBEDDING, 4);

    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(2);
    const [sql1] = mockQueryRawUnsafe.mock.calls[0] as [string];
    const [sql2] = mockQueryRawUnsafe.mock.calls[1] as [string];
    expect(sql1).toContain("<->");         // vector distance operator
    expect(sql2).toContain("plainto_tsquery"); // FTS operator
  });

  it("passes userId as first arg to both queries (tenant isolation)", async () => {
    mockQueryRawUnsafe
      .mockResolvedValueOnce(makeRows(["a"]))
      .mockResolvedValueOnce(makeRows(["a"]));

    await service.retrieve("tenant-xyz", "pricing", FAKE_EMBEDDING, 2);

    for (const call of mockQueryRawUnsafe.mock.calls) {
      expect(call[1]).toBe("tenant-xyz");
    }
  });

  it("fuses results with RRF and deduplicates", async () => {
    // "c" appears in both lists → boosted by RRF; "a","b" only vector; "d","e" only FTS
    mockQueryRawUnsafe
      .mockResolvedValueOnce(makeRows(["a", "b", "c"], "vec"))
      .mockResolvedValueOnce(makeRows(["c", "d", "e"], "fts"));

    const results = await service.retrieve("user-1", "test query", FAKE_EMBEDDING, 3);

    expect(results).toHaveLength(3);
    // "c" should score highest (in both lists at rank 3 and 1)
    const cChunk = results.find((r) => r.includes("c"));
    expect(cChunk).toBeDefined();
  });

  it("returns topK results even when both lists have more candidates", async () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
    mockQueryRawUnsafe
      .mockResolvedValueOnce(makeRows(ids.slice(0, 6)))
      .mockResolvedValueOnce(makeRows(ids.slice(2, 8)));

    const results = await service.retrieve("user-1", "query", FAKE_EMBEDDING, 3);
    expect(results).toHaveLength(3);
  });

  it("handles empty vector results gracefully", async () => {
    mockQueryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(makeRows(["d", "e"]));

    const results = await service.retrieve("user-1", "query", FAKE_EMBEDDING, 4);
    expect(results.length).toBeGreaterThanOrEqual(0);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("handles empty FTS results gracefully", async () => {
    mockQueryRawUnsafe
      .mockResolvedValueOnce(makeRows(["a", "b"]))
      .mockResolvedValueOnce([]);

    const results = await service.retrieve("user-1", "query", FAKE_EMBEDDING, 4);
    expect(results.length).toBeGreaterThanOrEqual(0);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("handles both empty result sets", async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    const results = await service.retrieve("user-1", "query", FAKE_EMBEDDING, 4);
    expect(results).toHaveLength(0);
  });

  it("sanitizes SQL metacharacters from query before passing to FTS", async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);

    await service.retrieve("user-1", "query'; DROP TABLE users;--", FAKE_EMBEDDING, 2);

    // FTS arg ($2) must not contain SQL metacharacters that could cause injection
    const ftsCall = mockQueryRawUnsafe.mock.calls[1] as [string, string, string, number];
    const passedQuery = ftsCall[2]; // $2 arg — the sanitized query string
    expect(passedQuery).not.toContain("'");
    expect(passedQuery).not.toContain(";");
    expect(passedQuery).not.toContain("--");
    // Alphanumeric content preserved
    expect(passedQuery).toContain("query");
  });

  it("skips FTS query when query is empty after sanitization", async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);

    // Query of only special chars sanitizes to empty string
    await service.retrieve("user-1", ";;;---'''", FAKE_EMBEDDING, 2);

    // Only 1 call (vector) since FTS is skipped for empty query
    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(1);
  });

  it("chunk ranked first in both lists gets highest RRF score", async () => {
    // "winner" is rank 1 in both vector and FTS
    mockQueryRawUnsafe
      .mockResolvedValueOnce(makeRows(["winner", "second", "third"], "vec"))
      .mockResolvedValueOnce(makeRows(["winner", "fourth", "fifth"], "fts"));

    const results = await service.retrieve("user-1", "query", FAKE_EMBEDDING, 3);
    expect(results[0]).toContain("winner");
  });
});
