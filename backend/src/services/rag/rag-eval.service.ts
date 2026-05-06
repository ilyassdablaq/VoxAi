/**
 * RAG Eval Pipeline
 *
 * Computes standard IR metrics over a golden dataset:
 *   Recall@K     — fraction of relevant docs found in top-K results
 *   Precision@K  — fraction of top-K results that are relevant
 *   MRR          — mean reciprocal rank of the first relevant result
 *
 * Used in: rag-eval.service.test.ts (offline / unit) and can be
 * wired to a nightly CI job against a staging DB for online eval.
 */

export interface GoldenQuery {
  query: string;
  relevantChunks: string[]; // substrings that must appear in a hit
}

export interface EvalResult {
  query: string;
  recallAtK: number;
  precisionAtK: number;
  reciprocalRank: number;
  retrieved: string[];
}

export interface EvalSummary {
  totalQueries: number;
  meanRecallAtK: number;
  meanPrecisionAtK: number;
  meanReciprocalRank: number;
  results: EvalResult[];
}

function isRelevant(chunk: string, relevantPatterns: string[]): boolean {
  const lower = chunk.toLowerCase();
  return relevantPatterns.some((p) => lower.includes(p.toLowerCase()));
}

function recallAtK(retrieved: string[], relevantPatterns: string[], k: number): number {
  const topK = retrieved.slice(0, k);
  const hits = relevantPatterns.filter((pattern) => topK.some((chunk) => chunk.toLowerCase().includes(pattern.toLowerCase())));
  return relevantPatterns.length === 0 ? 1 : hits.length / relevantPatterns.length;
}

function precisionAtK(retrieved: string[], relevantPatterns: string[], k: number): number {
  const topK = retrieved.slice(0, k);
  if (topK.length === 0) return 0;
  const hits = topK.filter((chunk) => isRelevant(chunk, relevantPatterns));
  return hits.length / topK.length;
}

function reciprocalRank(retrieved: string[], relevantPatterns: string[]): number {
  for (let i = 0; i < retrieved.length; i++) {
    if (isRelevant(retrieved[i]!, relevantPatterns)) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

export class RagEvalService {
  /**
   * Evaluates a retrieval function against a golden query set.
   *
   * @param goldenSet  - Array of {query, relevantChunks} pairs
   * @param retrieveFn - Function that takes a query and returns top-K chunks
   * @param k          - Cutoff for Recall@K and Precision@K (default: 4)
   */
  async evaluate(
    goldenSet: GoldenQuery[],
    retrieveFn: (query: string) => Promise<string[]>,
    k = 4,
  ): Promise<EvalSummary> {
    const results: EvalResult[] = [];

    for (const golden of goldenSet) {
      const retrieved = await retrieveFn(golden.query);
      results.push({
        query: golden.query,
        recallAtK: recallAtK(retrieved, golden.relevantChunks, k),
        precisionAtK: precisionAtK(retrieved, golden.relevantChunks, k),
        reciprocalRank: reciprocalRank(retrieved, golden.relevantChunks),
        retrieved,
      });
    }

    const mean = (arr: number[]) => (arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length);

    return {
      totalQueries: results.length,
      meanRecallAtK: mean(results.map((r) => r.recallAtK)),
      meanPrecisionAtK: mean(results.map((r) => r.precisionAtK)),
      meanReciprocalRank: mean(results.map((r) => r.reciprocalRank)),
      results,
    };
  }

  /**
   * Assert that a retrieval function meets minimum quality thresholds.
   * Throws if any threshold is violated — designed for use in CI pipelines.
   */
  async assertQualityThresholds(
    goldenSet: GoldenQuery[],
    retrieveFn: (query: string) => Promise<string[]>,
    thresholds: { minRecall?: number; minPrecision?: number; minMRR?: number },
    k = 4,
  ): Promise<EvalSummary> {
    const summary = await this.evaluate(goldenSet, retrieveFn, k);
    const failures: string[] = [];

    if (thresholds.minRecall !== undefined && summary.meanRecallAtK < thresholds.minRecall) {
      failures.push(`Recall@${k} ${summary.meanRecallAtK.toFixed(3)} < threshold ${thresholds.minRecall}`);
    }
    if (thresholds.minPrecision !== undefined && summary.meanPrecisionAtK < thresholds.minPrecision) {
      failures.push(`Precision@${k} ${summary.meanPrecisionAtK.toFixed(3)} < threshold ${thresholds.minPrecision}`);
    }
    if (thresholds.minMRR !== undefined && summary.meanReciprocalRank < thresholds.minMRR) {
      failures.push(`MRR ${summary.meanReciprocalRank.toFixed(3)} < threshold ${thresholds.minMRR}`);
    }

    if (failures.length > 0) {
      throw new Error(`RAG quality gate failed:\n${failures.join("\n")}`);
    }

    return summary;
  }
}

export const ragEvalService = new RagEvalService();
