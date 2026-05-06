-- HNSW Vector Index (pgvector >= 0.5). Falls 0.4: stattdessen IVFFlat (siehe Kommentar).
-- HNSW: bessere Recall@k bei Random-Inserts, kein Rebuild nötig.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_hnsw_idx"
      ON "KnowledgeChunk"
      USING hnsw ("embedding" vector_l2_ops)
      WITH (m = 16, ef_construction = 64);
  END IF;
END$$;

-- Fallback für pgvector < 0.5:
-- CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_ivfflat_idx"
--   ON "KnowledgeChunk" USING ivfflat ("embedding" vector_l2_ops) WITH (lists = 100);

-- Tenant-Filter beschleunigen (User-scoped Retrieval)
CREATE INDEX IF NOT EXISTS "KnowledgeDocument_userId_idx"
  ON "KnowledgeDocument" ("userId");

-- Usage-Aggregations (monthly billing)
CREATE INDEX IF NOT EXISTS "Usage_userId_createdAt_idx"
  ON "Usage" ("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Usage_conversationId_idx"
  ON "Usage" ("conversationId");

-- Message-Pagination (history queries für RAG-prefetch)
CREATE INDEX IF NOT EXISTS "Message_conversationId_role_createdAt_idx"
  ON "Message" ("conversationId", "role", "createdAt");

-- AuditLog Hotpath (admin search)
CREATE INDEX IF NOT EXISTS "AuditLog_principalId_createdAt_idx"
  ON "AuditLog" ("principalId", "createdAt" DESC);

-- ApiKey Lookup
CREATE INDEX IF NOT EXISTS "APIKey_keyPrefix_idx"
  ON "APIKey" ("keyPrefix");

-- Subscription billing-cycle
CREATE INDEX IF NOT EXISTS "Subscription_status_endsAt_idx"
  ON "Subscription" ("status", "endsAt");

-- Setze pgvector Search-Tuning (nur HNSW)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'KnowledgeChunk_embedding_hnsw_idx') THEN
    PERFORM set_config('hnsw.ef_search', '64', false);
  END IF;
END$$;
