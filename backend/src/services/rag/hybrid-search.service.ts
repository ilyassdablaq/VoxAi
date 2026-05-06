/**
 * Hybrid Search: BM25 (PostgreSQL full-text) + Vector (pgvector cosine)
 *
 * Each method returns an independently ranked list. Results are fused
 * with Reciprocal Rank Fusion (RRF, k=60) which is parameter-free and
 * consistently outperforms simple score averaging.
 *
 * RRF formula: score(d) = Σ 1 / (k + rank_i(d))
 *
 * Migration note: KnowledgeChunk.chunkText must have a GIN tsvector index
 * for full-text performance. Add via:
 *   CREATE INDEX CONCURRENTLY idx_kc_fts
 *   ON "KnowledgeChunk" USING GIN (to_tsvector('english', "chunkText"));
 */

import { prisma } from "../../infra/database/prisma.js";
import { logger } from "../../config/logger.js";

const RRF_K = 60;
const DEFAULT_TOP_K = 4;
const DEFAULT_CANDIDATE_MULTIPLIER = 3; // fetch 3× topK from each method before fusion

type RawVectorRow = { id: string; chunk_text: string };
type RawFtsRow = { id: string; chunk_text: string };

function buildRrfScore(
  vectorRanks: Map<string, number>,
  ftsRanks: Map<string, number>,
  allIds: Set<string>,
): Array<{ id: string; score: number }> {
  const scores: Array<{ id: string; score: number }> = [];
  for (const id of allIds) {
    const vRank = vectorRanks.get(id);
    const fRank = ftsRanks.get(id);
    const score =
      (vRank !== undefined ? 1 / (RRF_K + vRank) : 0) +
      (fRank !== undefined ? 1 / (RRF_K + fRank) : 0);
    scores.push({ id, score });
  }
  scores.sort((a, b) => b.score - a.score);
  return scores;
}

function toVectorSql(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

function sanitizeFtsQuery(query: string): string {
  // Keep only alphanumeric + spaces; collapse whitespace; plainto_tsquery handles tokenisation
  return query
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

export class HybridSearchService {
  /**
   * Hybrid retrieval: fuses vector similarity and BM25 full-text results via RRF.
   *
   * @param userId    - Tenant isolation: only searches documents owned by this user
   * @param query     - Natural-language query string
   * @param embedding - Pre-computed query embedding (1536-dim)
   * @param topK      - Number of results to return after fusion
   */
  async retrieve(
    userId: string,
    query: string,
    embedding: number[],
    topK = DEFAULT_TOP_K,
  ): Promise<string[]> {
    const candidates = topK * DEFAULT_CANDIDATE_MULTIPLIER;
    const embeddingSql = toVectorSql(embedding);
    const safeQuery = sanitizeFtsQuery(query);

    const [vectorRows, ftsRows] = await Promise.all([
      this.vectorSearch(userId, embeddingSql, candidates),
      this.ftsSearch(userId, safeQuery, candidates),
    ]);

    logger.debug(
      { userId, vectorHits: vectorRows.length, ftsHits: ftsRows.length, topK },
      "Hybrid search candidates retrieved",
    );

    // Build rank maps (rank is 1-based)
    const vectorRanks = new Map<string, number>(vectorRows.map((r, i) => [r.id, i + 1]));
    const ftsRanks = new Map<string, number>(ftsRows.map((r, i) => [r.id, i + 1]));

    const allIds = new Set<string>([...vectorRows.map((r) => r.id), ...ftsRows.map((r) => r.id)]);

    const fused = buildRrfScore(vectorRanks, ftsRanks, allIds).slice(0, topK);

    // Reassemble text from whichever result set has the chunk
    const chunkTextById = new Map<string, string>([
      ...vectorRows.map((r): [string, string] => [r.id, r.chunk_text]),
      ...ftsRows.map((r): [string, string] => [r.id, r.chunk_text]),
    ]);

    return fused.map((item) => chunkTextById.get(item.id) ?? "");
  }

  private async vectorSearch(userId: string, embeddingSql: string, limit: number): Promise<RawVectorRow[]> {
    return prisma.$queryRawUnsafe<RawVectorRow[]>(
      `SELECT kc.id, kc."chunkText" AS chunk_text
       FROM "KnowledgeChunk" kc
       INNER JOIN "KnowledgeDocument" kd ON kd.id = kc."documentId"
       WHERE kd."userId" = $1
       ORDER BY kc.embedding <-> $2::vector
       LIMIT $3`,
      userId,
      embeddingSql,
      limit,
    );
  }

  private async ftsSearch(userId: string, query: string, limit: number): Promise<RawFtsRow[]> {
    if (!query) return [];
    return prisma.$queryRawUnsafe<RawFtsRow[]>(
      `SELECT kc.id, kc."chunkText" AS chunk_text
       FROM "KnowledgeChunk" kc
       INNER JOIN "KnowledgeDocument" kd ON kd.id = kc."documentId"
       WHERE kd."userId" = $1
         AND to_tsvector('english', kc."chunkText") @@ plainto_tsquery('english', $2)
       ORDER BY ts_rank(to_tsvector('english', kc."chunkText"), plainto_tsquery('english', $2)) DESC
       LIMIT $3`,
      userId,
      query,
      limit,
    );
  }
}

export const hybridSearchService = new HybridSearchService();
