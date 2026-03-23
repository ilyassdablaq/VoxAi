import { createHash } from "node:crypto";
import * as pdfParse from "pdf-parse";
import OpenAI from "openai";
import { XMLParser } from "fast-xml-parser";
import * as cheerio from "cheerio";
import { AppError } from "../../common/errors/app-error.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { prisma } from "../../infra/database/prisma.js";

const EMBEDDING_DIMENSION = 1536;
const CHUNK_WORDS = 400;
const CHUNK_OVERLAP_WORDS = 70;
const CRAWL_TIMEOUT_MS = 12000;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function chunkText(text: string, wordsPerChunk = CHUNK_WORDS, overlapWords = CHUNK_OVERLAP_WORDS): string[] {
  const words = normalizeWhitespace(text).split(" ").filter(Boolean);
  if (words.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + wordsPerChunk, words.length);
    chunks.push(words.slice(start, end).join(" "));
    if (end >= words.length) {
      break;
    }
    start = Math.max(end - overlapWords, start + 1);
  }

  return chunks;
}

function toVectorSql(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

function flattenObject(value: unknown, path = "root", lines: string[] = []): string[] {
  if (value === null || value === undefined) {
    return lines;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenObject(item, `${path}[${index}]`, lines));
    return lines;
  }

  if (typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
      flattenObject(nested, `${path}.${key}`, lines);
    });
    return lines;
  }

  lines.push(`${path}: ${String(value)}`);
  return lines;
}

export class RagService {
  private readonly embeddingClient: OpenAI | null;

  constructor() {
    this.embeddingClient = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;
  }

  async retrieveContext(userId: string, queryText: string, topK = 4): Promise<string[]> {
    logger.debug({ userId, topK, queryLength: queryText.length }, "RAG retrieval started");
    const queryEmbedding = await this.embedText(queryText);
    const embeddingSql = toVectorSql(queryEmbedding);

    const rows = (await prisma.$queryRawUnsafe(
      `SELECT kc."chunkText" as chunk_text
       FROM "KnowledgeChunk" kc
       INNER JOIN "KnowledgeDocument" kd ON kd.id = kc."documentId"
       WHERE kd."userId" = $1
       ORDER BY kc.embedding <-> $2::vector
       LIMIT $3`,
      userId,
      embeddingSql,
      topK,
    )) as Array<{ chunk_text: string }>;

    const contexts = rows.map((row) => row.chunk_text);
    logger.debug({ userId, retrievedChunks: contexts.length }, "RAG retrieval completed");
    return contexts;
  }

  async listDocuments(userId: string) {
    return prisma.knowledgeDocument.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        _count: {
          select: {
            chunks: true,
          },
        },
      },
    });
  }

  async deleteDocument(userId: string, documentId: string) {
    const deleted = await prisma.knowledgeDocument.deleteMany({
      where: {
        id: documentId,
        userId,
      },
    });

    if (deleted.count === 0) {
      throw new AppError(404, "DOCUMENT_NOT_FOUND", "Knowledge document not found");
    }
  }

  async ingestFromUpload(input: { userId: string; fileName: string; mimeType: string; contentBase64: string }) {
    logger.info({ userId: input.userId, fileName: input.fileName, mimeType: input.mimeType }, "RAG ingest file (base64) started");
    const buffer = Buffer.from(input.contentBase64, "base64");
    if (!buffer.length) {
      throw new AppError(400, "EMPTY_FILE", "Uploaded file is empty");
    }
    return this.ingestFromBuffer({
      userId: input.userId,
      fileName: input.fileName,
      originalFileName: input.fileName,
      mimeType: input.mimeType,
      buffer,
    });
  }

  async ingestFromBuffer(input: {
    userId: string;
    fileName: string;
    originalFileName: string;
    mimeType: string;
    buffer: Buffer;
  }) {
    logger.info(
      {
        userId: input.userId,
        fileName: input.fileName,
        originalFileName: input.originalFileName,
        mimeType: input.mimeType,
        fileSize: input.buffer.length,
      },
      "RAG ingest file (multipart/buffer) started",
    );

    const lowerName = input.fileName.toLowerCase();

    let extractedText = "";
    if (input.mimeType.includes("pdf") || lowerName.endsWith(".pdf")) {
      try {
        const parsed = await (pdfParse as unknown as (dataBuffer: Buffer) => Promise<{ text: string }>)(input.buffer);
        extractedText = parsed.text;
      } catch (error) {
        logger.warn({ error, fileName: input.fileName }, "RAG PDF parsing failed");
        throw new AppError(400, "PDF_PARSE_FAILED", "Could not extract text from PDF file");
      }
    } else {
      extractedText = input.buffer.toString("utf-8");
    }

    if (!normalizeWhitespace(extractedText)) {
      throw new AppError(400, "EMPTY_DOCUMENT", "Could not extract text from the uploaded file");
    }

    const result = await this.ingestPlainText({
      userId: input.userId,
      title: input.fileName,
      content: extractedText,
    });

    logger.info(
      {
        userId: input.userId,
        fileName: input.fileName,
        chunksCount: result.chunksCount,
      },
      "RAG ingest file completed",
    );

    return result;
  }

  async ingestStructuredData(input: { userId: string; format: "json" | "xml"; title: string; content: string }) {
    logger.info({ userId: input.userId, title: input.title, format: input.format }, "RAG ingest structured data started");
    let structuredText = "";

    try {
      if (input.format === "json") {
        const parsed = JSON.parse(input.content) as unknown;
        structuredText = flattenObject(parsed).join("\n");
      } else {
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: "@",
        });
        const parsed = parser.parse(input.content) as unknown;
        structuredText = flattenObject(parsed).join("\n");
      }
    } catch (error) {
      logger.warn({ error, userId: input.userId, format: input.format }, "RAG structured parse failed");
      throw new AppError(400, "STRUCTURED_PARSE_FAILED", `Invalid ${input.format.toUpperCase()} payload`);
    }

    if (!normalizeWhitespace(structuredText)) {
      throw new AppError(400, "EMPTY_DOCUMENT", "Structured input did not contain parsable text");
    }

    const result = await this.ingestPlainText({
      userId: input.userId,
      title: input.title,
      content: structuredText,
    });

    logger.info({ userId: input.userId, title: input.title, chunksCount: result.chunksCount }, "RAG ingest structured completed");
    return result;
  }

  async ingestWebsite(input: { userId: string; url: string; maxPages: number }) {
    logger.info({ userId: input.userId, url: input.url, maxPages: input.maxPages }, "RAG website crawl started");
    const rootUrl = new URL(input.url);
    if (!["http:", "https:"].includes(rootUrl.protocol)) {
      throw new AppError(400, "INVALID_URL_PROTOCOL", "Only HTTP/HTTPS URLs are supported");
    }

    const visited = new Set<string>();
    const queue: string[] = [rootUrl.toString()];
    const collectedPages: Array<{ url: string; text: string }> = [];
    const crawlErrors: Array<{ url: string; reason: string }> = [];

    while (queue.length > 0 && visited.size < input.maxPages) {
      const currentUrl = queue.shift();
      if (!currentUrl || visited.has(currentUrl)) {
        continue;
      }

      visited.add(currentUrl);

      let response: Response | null = null;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CRAWL_TIMEOUT_MS);

      try {
        response = await fetch(currentUrl, {
          headers: {
            "User-Agent": "voxflow-bot/1.0",
            Accept: "text/html,application/xhtml+xml",
          },
          redirect: "follow",
          signal: controller.signal,
        });

        if (!response.ok) {
          crawlErrors.push({ url: currentUrl, reason: `HTTP ${response.status}` });
          continue;
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("text/html")) {
          crawlErrors.push({ url: currentUrl, reason: `Unsupported content-type ${contentType}` });
          continue;
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        $("script, style, noscript").remove();

        const pageText = normalizeWhitespace(
          [
            $("h1, h2, h3").text(),
            $("main").text(),
            $("article").text(),
            $("p").text(),
            $("li").text(),
          ]
            .filter(Boolean)
            .join(" "),
        );

        if (pageText) {
          collectedPages.push({
            url: currentUrl,
            text: pageText,
          });
        }

        const links = $("a[href]")
          .map((_, anchor) => $(anchor).attr("href") || "")
          .get()
          .map((href) => {
            try {
              return new URL(href, currentUrl).toString();
            } catch {
              return "";
            }
          })
          .filter(Boolean)
          .filter((nextUrl) => {
            try {
              const parsed = new URL(nextUrl);
              return parsed.origin === rootUrl.origin;
            } catch {
              return false;
            }
          });

        for (const nextUrl of links) {
          if (!visited.has(nextUrl) && !queue.includes(nextUrl) && queue.length + visited.size < input.maxPages + 4) {
            queue.push(nextUrl);
          }
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Unknown fetch error";
        crawlErrors.push({ url: currentUrl, reason });
        continue;
      } finally {
        clearTimeout(timeout);
      }
    }

    const merged = collectedPages
      .map((page) => `Source: ${page.url}\n${page.text}`)
      .join("\n\n");

    if (!merged) {
      logger.warn({ userId: input.userId, url: input.url, crawlErrors }, "RAG website crawl produced no content");
      throw new AppError(400, "URL_CRAWL_EMPTY", "No crawlable text content found for the provided URL", {
        crawlErrors: crawlErrors.slice(0, 5),
      });
    }

    const result = await this.ingestPlainText({
      userId: input.userId,
      title: `Website Crawl: ${rootUrl.hostname}`,
      content: merged,
    });

    logger.info(
      {
        userId: input.userId,
        url: input.url,
        visitedPages: visited.size,
        collectedPages: collectedPages.length,
        chunksCount: result.chunksCount,
      },
      "RAG website crawl completed",
    );

    return result;
  }

  buildPrompt(userMessage: string, contexts: string[]): string {
    const contextText = contexts.length > 0 ? contexts.join("\n\n") : "No relevant context found.";
    return `You are VoxAI assistant. Use only the provided context when it is relevant, and be honest when context is missing.\n\nContext:\n${contextText}\n\nUser:\n${userMessage}`;
  }

  private async ingestPlainText(input: { userId: string; title: string; content: string }) {
    logger.debug({ userId: input.userId, title: input.title, contentLength: input.content.length }, "RAG plain text ingest preprocessing");
    const normalized = normalizeWhitespace(input.content);
    const chunks = chunkText(normalized);

    if (chunks.length === 0) {
      throw new AppError(400, "EMPTY_DOCUMENT", "No usable content found after preprocessing");
    }

    logger.debug({ userId: input.userId, title: input.title, chunksCount: chunks.length }, "RAG chunking completed");

    const document = await prisma.knowledgeDocument.create({
      data: {
        userId: input.userId,
        title: input.title,
        content: normalized,
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    });

    for (const chunk of chunks) {
      const embedding = await this.embedText(chunk);
      const vectorText = toVectorSql(embedding);
      await prisma.$executeRawUnsafe(
        `INSERT INTO "KnowledgeChunk" ("documentId", "chunkText", "embedding") VALUES ($1, $2, $3::vector)`,
        document.id,
        chunk,
        vectorText,
      );
    }

    return {
      document,
      chunksCount: chunks.length,
      wordCount: normalized.split(" ").length,
    };
  }

  private async embedText(text: string): Promise<number[]> {
    if (this.embeddingClient) {
      const result = await this.embeddingClient.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });

      const embedding = result.data[0]?.embedding;
      if (embedding && embedding.length > 0) {
        if (embedding.length === EMBEDDING_DIMENSION) {
          return embedding;
        }

        if (embedding.length > EMBEDDING_DIMENSION) {
          return embedding.slice(0, EMBEDDING_DIMENSION);
        }

        return [...embedding, ...new Array<number>(EMBEDDING_DIMENSION - embedding.length).fill(0)];
      }
    }

    logger.debug({ textLength: text.length }, "RAG embedding fallback to pseudo vector");
    return this.pseudoEmbedding(text);
  }

  private pseudoEmbedding(text: string): number[] {
    const hash = createHash("sha256").update(text).digest();
    const vector = new Array<number>(EMBEDDING_DIMENSION);

    for (let index = 0; index < EMBEDDING_DIMENSION; index += 1) {
      const byte = hash[index % hash.length] ?? 0;
      vector[index] = (byte / 255) * 2 - 1;
    }

    return vector;
  }
}
