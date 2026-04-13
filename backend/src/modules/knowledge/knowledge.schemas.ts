import { z } from "zod";

export const ingestFileSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  contentBase64: z.string().min(1),
});

export const ingestFileMultipartFieldsSchema = z.object({
  title: z.string().min(1).max(255).optional(),
});

export const ingestStructuredSchema = z.object({
  format: z.enum(["json", "xml"]),
  title: z.string().min(1).max(255),
  content: z.string().min(2),
});

export const ingestUrlSchema = z.object({
  url: z.preprocess(
    (raw) => {
      if (typeof raw !== "string") {
        return raw;
      }

      const trimmed = raw.trim();
      if (!trimmed) {
        return trimmed;
      }

      return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    },
    z
      .string()
      .url()
      .refine((value) => {
        const normalized = value.toLowerCase();
        return normalized.startsWith("http://") || normalized.startsWith("https://");
      }, "URL must start with http:// or https://"),
  ),
  maxPages: z.coerce.number().int().min(1).max(10).default(4),
});

export const documentIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type IngestFileInput = z.infer<typeof ingestFileSchema>;
export type IngestFileMultipartFieldsInput = z.infer<typeof ingestFileMultipartFieldsSchema>;
export type IngestStructuredInput = z.infer<typeof ingestStructuredSchema>;
export type IngestUrlInput = z.infer<typeof ingestUrlSchema>;
