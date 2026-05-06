import { createHash } from "node:crypto";
import { redis } from "../../infra/cache/redis.js";
import { logger } from "../../config/logger.js";

const RETRIEVAL_TTL_SECONDS = 45;
const EMBEDDING_TTL_SECONDS = 60 * 60 * 24 * 30;
const EMBEDDING_KEY_PREFIX = "rag:emb:v1:";
const RETRIEVAL_KEY_PREFIX = "rag:ret:v1:";

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export class RagCacheService {
  retrievalKey(userId: string, queryText: string, topK: number): string {
    return `${RETRIEVAL_KEY_PREFIX}${userId}:${topK}:${sha256(normalize(queryText))}`;
  }

  embeddingKey(model: string, text: string): string {
    return `${EMBEDDING_KEY_PREFIX}${model}:${sha256(normalize(text))}`;
  }

  async getRetrieval(userId: string, queryText: string, topK: number): Promise<string[] | null> {
    try {
      const raw = await redis.get(this.retrievalKey(userId, queryText, topK));
      return raw ? (JSON.parse(raw) as string[]) : null;
    } catch (error) {
      logger.warn({ error }, "RAG retrieval cache GET failed");
      return null;
    }
  }

  async setRetrieval(userId: string, queryText: string, topK: number, contexts: string[]): Promise<void> {
    try {
      await redis.set(
        this.retrievalKey(userId, queryText, topK),
        JSON.stringify(contexts),
        "EX",
        RETRIEVAL_TTL_SECONDS,
      );
    } catch (error) {
      logger.warn({ error }, "RAG retrieval cache SET failed");
    }
  }

  async getEmbedding(model: string, text: string): Promise<number[] | null> {
    try {
      const raw = await redis.get(this.embeddingKey(model, text));
      return raw ? (JSON.parse(raw) as number[]) : null;
    } catch (error) {
      logger.warn({ error }, "RAG embedding cache GET failed");
      return null;
    }
  }

  async setEmbedding(model: string, text: string, vector: number[]): Promise<void> {
    try {
      await redis.set(
        this.embeddingKey(model, text),
        JSON.stringify(vector),
        "EX",
        EMBEDDING_TTL_SECONDS,
      );
    } catch (error) {
      logger.warn({ error }, "RAG embedding cache SET failed");
    }
  }

  async invalidateUser(userId: string): Promise<void> {
    try {
      const stream = redis.scanStream({ match: `${RETRIEVAL_KEY_PREFIX}${userId}:*`, count: 200 });
      const pipeline = redis.pipeline();
      let queued = 0;
      for await (const keys of stream) {
        for (const key of keys as string[]) {
          pipeline.del(key);
          queued++;
        }
      }
      if (queued > 0) {
        await pipeline.exec();
      }
    } catch (error) {
      logger.warn({ error, userId }, "RAG retrieval cache invalidation failed");
    }
  }
}

export const ragCacheService = new RagCacheService();
