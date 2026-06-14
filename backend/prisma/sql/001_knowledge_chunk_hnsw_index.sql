-- HNSW vector index for KnowledgeChunk.embedding (RAG retrieval).
--
-- Matches the cosine distance operator (`<=>`) used in RagService.retrieveContext.
-- Requires pgvector >= 0.5.0.
--
-- NOTE: The app also creates this automatically at boot via
-- src/infra/database/ensure-indexes.ts (deploy uses `prisma db push`, not
-- `migrate deploy`). This file is kept for manual application / reference.
--
-- For a large existing table, prefer CONCURRENTLY (cannot run in a transaction):
--   CREATE INDEX CONCURRENTLY ...

CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_hnsw_cosine"
  ON "KnowledgeChunk" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
