import { describe, expect, it } from "vitest";
import { ingestFileSchema, ingestStructuredSchema, ingestUrlSchema } from "./knowledge.schemas";

function randomAscii(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:/._-";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

describe("knowledge schema fuzzing", () => {
  it("normalizes fuzz URL input to explicit http(s) URLs only", () => {
    const badPrefixes = ["javascript:", "data:", "file:", "ftp:", "ws:"];

    for (let i = 0; i < 200; i += 1) {
      const prefix = badPrefixes[i % badPrefixes.length];
      const candidate = `${prefix}${randomAscii(16)}`;
      const parsed = ingestUrlSchema.safeParse({ url: candidate, maxPages: 2 });
      if (parsed.success) {
        expect(parsed.data.url.startsWith("http://") || parsed.data.url.startsWith("https://")).toBe(true);
      } else {
        expect(parsed.success).toBe(false);
      }
    }
  });

  it("enforces maxPages range under random fuzz input", () => {
    for (let i = 0; i < 100; i += 1) {
      const outOfRange = i % 2 === 0 ? -(i + 1) : 10 + i;
      const parsed = ingestUrlSchema.safeParse({ url: "https://example.com", maxPages: outOfRange });
      expect(parsed.success).toBe(false);
    }
  });

  it("rejects invalid ingestion file payloads under random fuzz input", () => {
    for (let i = 0; i < 100; i += 1) {
      const parsed = ingestFileSchema.safeParse({
        fileName: i % 3 === 0 ? "" : randomAscii(260),
        mimeType: i % 2 === 0 ? "" : randomAscii(140),
        contentBase64: i % 5 === 0 ? "" : randomAscii(8),
      });
      expect(parsed.success).toBe(false);
    }
  });

  it("rejects malformed structured payloads under random fuzz input", () => {
    for (let i = 0; i < 100; i += 1) {
      const parsed = ingestStructuredSchema.safeParse({
        format: i % 2 === 0 ? "yaml" : "csv",
        title: i % 3 === 0 ? "" : randomAscii(300),
        content: i % 4 === 0 ? "" : randomAscii(1),
      });
      expect(parsed.success).toBe(false);
    }
  });
});
