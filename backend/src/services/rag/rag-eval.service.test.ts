import { describe, it, expect } from "vitest";
import { RagEvalService, GoldenQuery } from "./rag-eval.service";

const GOLDEN_SET: GoldenQuery[] = [
  {
    query: "How do I reset my password?",
    relevantChunks: ["password reset", "forgot password"],
  },
  {
    query: "What are the pricing plans?",
    relevantChunks: ["pro plan", "enterprise plan", "free tier"],
  },
  {
    query: "How to integrate the widget?",
    relevantChunks: ["embed key", "javascript snippet", "iframe"],
  },
  {
    query: "What is the refund policy?",
    relevantChunks: ["refund", "30-day", "money back"],
  },
];

// Simulated corpus — each entry maps to keyword patterns
const CORPUS = [
  "The password reset flow: click forgot password on the login page and enter your email.",
  "Our pro plan includes unlimited conversations, analytics, and priority support.",
  "The enterprise plan offers custom SLAs, SSO, and a dedicated success manager.",
  "The free tier gives you 100 conversations per month at no cost.",
  "To integrate, copy the embed key from the dashboard and add the javascript snippet to your site.",
  "You can also embed the widget via an iframe for no-code platforms.",
  "Refund policy: we offer a 30-day money back guarantee on all paid plans.",
  "Contact our team for enterprise pricing.",
];

function makeIdealRetriever(topK = 4) {
  return async (query: string): Promise<string[]> => {
    // Simple BM25-like term overlap scoring for testing
    const queryTokens = query.toLowerCase().split(/\W+/).filter(Boolean);
    const scored = CORPUS.map((chunk) => {
      const chunkLower = chunk.toLowerCase();
      const score = queryTokens.filter((t) => chunkLower.includes(t)).length;
      return { chunk, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map((s) => s.chunk);
  };
}

function makeWorstRetriever() {
  return async (_query: string): Promise<string[]> => {
    return ["Unrelated chunk about weather.", "Something about cooking recipes."];
  };
}

function makeEmptyRetriever() {
  return async (_query: string): Promise<string[]> => [];
}

describe("RagEvalService", () => {
  const service = new RagEvalService();

  it("returns 1 query result per golden entry", async () => {
    const summary = await service.evaluate(GOLDEN_SET, makeIdealRetriever(), 4);
    expect(summary.totalQueries).toBe(GOLDEN_SET.length);
    expect(summary.results).toHaveLength(GOLDEN_SET.length);
  });

  it("achieves high Recall@4 with ideal retriever", async () => {
    const summary = await service.evaluate(GOLDEN_SET, makeIdealRetriever(), 4);
    expect(summary.meanRecallAtK).toBeGreaterThanOrEqual(0.6);
  });

  it("achieves MRR > 0 with ideal retriever", async () => {
    const summary = await service.evaluate(GOLDEN_SET, makeIdealRetriever(), 4);
    expect(summary.meanReciprocalRank).toBeGreaterThan(0);
  });

  it("scores 0 Recall with worst retriever", async () => {
    const summary = await service.evaluate(GOLDEN_SET, makeWorstRetriever(), 4);
    expect(summary.meanRecallAtK).toBe(0);
    expect(summary.meanReciprocalRank).toBe(0);
  });

  it("scores 0 for empty retriever", async () => {
    const summary = await service.evaluate(GOLDEN_SET, makeEmptyRetriever(), 4);
    expect(summary.meanRecallAtK).toBe(0);
    expect(summary.meanPrecisionAtK).toBe(0);
    expect(summary.meanReciprocalRank).toBe(0);
  });

  it("computes reciprocal rank correctly for first-position hit", async () => {
    const singleGolden: GoldenQuery[] = [
      { query: "password", relevantChunks: ["password reset"] },
    ];
    // retriever always returns the password chunk first
    const retriever = async () => [
      "The password reset flow: click forgot password on the login page.",
      "Some other chunk",
    ];
    const summary = await service.evaluate(singleGolden, retriever, 4);
    expect(summary.results[0]!.reciprocalRank).toBe(1); // rank 1 → 1/1
  });

  it("computes reciprocal rank correctly for second-position hit", async () => {
    const singleGolden: GoldenQuery[] = [
      { query: "refund", relevantChunks: ["refund"] },
    ];
    const retriever = async () => [
      "Unrelated pricing content.",
      "Refund policy: we offer a 30-day money back guarantee.",
    ];
    const summary = await service.evaluate(singleGolden, retriever, 4);
    expect(summary.results[0]!.reciprocalRank).toBeCloseTo(0.5); // rank 2 → 1/2
  });

  it("Precision@K reflects ratio of relevant in top-K", async () => {
    const singleGolden: GoldenQuery[] = [
      { query: "pricing", relevantChunks: ["pro plan"] },
    ];
    // 1 relevant out of 4 results → precision = 0.25
    const retriever = async () => [
      "Our pro plan is great.",
      "Unrelated A",
      "Unrelated B",
      "Unrelated C",
    ];
    const summary = await service.evaluate(singleGolden, retriever, 4);
    expect(summary.results[0]!.precisionAtK).toBeCloseTo(0.25);
  });

  it("assertQualityThresholds passes when above thresholds", async () => {
    await expect(
      service.assertQualityThresholds(GOLDEN_SET, makeIdealRetriever(), { minRecall: 0.3, minMRR: 0.1 }),
    ).resolves.toBeDefined();
  });

  it("assertQualityThresholds throws when below threshold", async () => {
    await expect(
      service.assertQualityThresholds(GOLDEN_SET, makeWorstRetriever(), { minRecall: 0.5 }),
    ).rejects.toThrow(/RAG quality gate failed/);
  });

  it("assertQualityThresholds reports all failing metrics in error message", async () => {
    try {
      await service.assertQualityThresholds(
        GOLDEN_SET,
        makeWorstRetriever(),
        { minRecall: 0.9, minPrecision: 0.9, minMRR: 0.9 },
      );
      expect.fail("Should have thrown");
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain("Recall");
      expect(msg).toContain("Precision");
      expect(msg).toContain("MRR");
    }
  });

  it("handles golden set with single query", async () => {
    const single: GoldenQuery[] = [{ query: "refund", relevantChunks: ["refund"] }];
    const summary = await service.evaluate(single, makeIdealRetriever(), 4);
    expect(summary.totalQueries).toBe(1);
    expect(summary.meanRecallAtK).toBeGreaterThanOrEqual(0);
  });

  it("handles empty golden set gracefully", async () => {
    const summary = await service.evaluate([], makeIdealRetriever(), 4);
    expect(summary.totalQueries).toBe(0);
    expect(summary.meanRecallAtK).toBe(0);
    expect(summary.meanReciprocalRank).toBe(0);
  });
});
