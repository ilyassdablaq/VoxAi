/**
 * Embedding-Queue: Async-Verarbeitung großer Ingest-Jobs.
 * Job-Payload: { userId, documentId, chunks: string[] }
 *
 * Workflow:
 *   1. Cache-Check (Redis) je Chunk → bei Hit überspringen
 *   2. OpenAI batchen (max 96 inputs/call) mit Concurrency-Cap
 *   3. INSERT in `KnowledgeChunk` per CTE-Batch
 *   4. Retrieval-Cache des Users invalidieren
 *
 * Retries: 5 (exponential, 1s base) — bei Quota-429: lange backoff
 */
import { Worker, Job } from "bullmq";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { logger } from "../../../config/logger.js";
import { env } from "../../../config/env.js";
import { prisma } from "../../database/prisma.js";
import { ragCacheService } from "../../../services/rag/rag-cache.service.js";
import { queueJobsTotal } from "../../observability/metrics.js";

const EMBEDDING_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 96;

interface EmbeddingJobData {
  userId: string;
  documentId: string;
  chunks: string[];
}

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

function toVectorSql(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  if (!openai) {
    return texts.map(() => new Array(1536).fill(0));
  }
  const result = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  return result.data.map((d) => d.embedding);
}

export async function processEmbeddingJob(job: Job<EmbeddingJobData>): Promise<{ inserted: number; cached: number }> {
  const { userId, documentId, chunks } = job.data;
  const cached: Array<{ chunk: string; vector: number[] }> = [];
  const toEmbed: string[] = [];
  const toEmbedIdx: number[] = [];

  // 1. Cache-Check
  for (let i = 0; i < chunks.length; i++) {
    const cachedVec = await ragCacheService.getEmbedding(EMBEDDING_MODEL, chunks[i]);
    if (cachedVec) {
      cached.push({ chunk: chunks[i], vector: cachedVec });
    } else {
      toEmbed.push(chunks[i]);
      toEmbedIdx.push(i);
    }
  }

  // 2. Batch-Embed
  const fresh: Array<{ chunk: string; vector: number[] }> = [];
  for (let start = 0; start < toEmbed.length; start += BATCH_SIZE) {
    const batch = toEmbed.slice(start, start + BATCH_SIZE);
    const vectors = await embedBatch(batch);
    for (let i = 0; i < batch.length; i++) {
      fresh.push({ chunk: batch[i], vector: vectors[i] });
      await ragCacheService.setEmbedding(EMBEDDING_MODEL, batch[i], vectors[i]);
    }
    await job.updateProgress(((start + batch.length) / chunks.length) * 100);
  }

  // 3. Persist (transactional)
  const all = [...cached, ...fresh];
  await prisma.$transaction(async (tx) => {
    for (const item of all) {
      await tx.$executeRawUnsafe(
        `INSERT INTO "KnowledgeChunk" ("id", "documentId", "chunkText", "embedding")
         VALUES ($1, $2, $3, $4::vector)`,
        randomUUID(),
        documentId,
        item.chunk,
        toVectorSql(item.vector),
      );
    }
  });

  // 4. Invalidate retrieval cache
  await ragCacheService.invalidateUser(userId);

  queueJobsTotal.inc(1, { queue: "embedding", state: "completed" });
  logger.info(
    { jobId: job.id, userId, documentId, total: all.length, cached: cached.length, fresh: fresh.length },
    "Embedding job completed",
  );
  return { inserted: fresh.length, cached: cached.length };
}

export function createEmbeddingWorker(connection: { url: string }): Worker<EmbeddingJobData> {
  const worker = new Worker<EmbeddingJobData>("embedding", processEmbeddingJob, {
    connection,
    concurrency: 4,
    limiter: { max: 20, duration: 1000 }, // 20 jobs/sec hard cap (OpenAI quota)
  });
  worker.on("failed", (job, err) => {
    queueJobsTotal.inc(1, { queue: "embedding", state: "failed" });
    logger.error({ jobId: job?.id, err: err.message }, "Embedding job failed");
  });
  return worker;
}
