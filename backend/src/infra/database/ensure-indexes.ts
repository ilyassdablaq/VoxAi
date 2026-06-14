import { prisma } from "./prisma.js";
import { logger } from "../../config/logger.js";

/**
 * Idempotently ensure performance indexes that Prisma cannot manage itself
 * (the `embedding` column is an Unsupported `vector` type).
 *
 * Runs on every boot after the schema is in place. `IF NOT EXISTS` makes this a
 * cheap no-op once created. Deploy uses `prisma db push`, so this is the
 * reliable place to create vector indexes (a migration file would not run).
 *
 * The HNSW index uses `vector_cosine_ops` to match the cosine distance (`<=>`)
 * operator used in retrieval. Requires pgvector >= 0.5.0; on older versions the
 * statement fails and we fall back to a sequential scan (still correct).
 */
export async function ensureVectorIndexes(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_hnsw_cosine"
       ON "KnowledgeChunk" USING hnsw (embedding vector_cosine_ops)
       WITH (m = 16, ef_construction = 64);`,
    );
    logger.info("Vector index ensured (KnowledgeChunk_embedding_hnsw_cosine)");
  } catch (error) {
    logger.warn(
      { error: (error as Error).message },
      "Could not create HNSW vector index; retrieval falls back to sequential scan",
    );
  }
}
