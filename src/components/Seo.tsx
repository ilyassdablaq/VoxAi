import { useEffect } from "react";

interface SeoProps {
  title: string;
  description: string;
  path?: string;
  image?: string;
  noindex?: boolean;
  type?: "website" | "article";
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>;
}

const SITE_NAME = "VoxAI";
const DEFAULT_IMAGE = "/og-image.svg";
const STRUCTURED_DATA_TAG_ID = "seo-structured-data";

function extractAttributeName(selector: string): string | null {
  const attributeMatch = selector.match(/\[(name|property|rel)="([^"]+)"\]/);
  return attributeMatch ? attributeMatch[2] : null;
}

function updateMeta(selector: string, attribute: string, value: string): void {
  const element = document.head.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
  const selectorAttribute = extractAttributeName(selector);

  if (element) {
    element.setAttribute(attribute, value);
    return;
  }

  if (selector.startsWith("link")) {
    const link = document.createElement("link");
    if (selectorAttribute) {
      link.setAttribute("rel", selectorAttribute);
    }
    link.setAttribute(attribute, value);
    document.head.appendChild(link);
    return;
  }

  const meta = document.createElement("meta");
  if (selectorAttribute) {
    meta.setAttribute(selector.includes("property=") ? "property" : "name", selectorAttribute);
  }
  meta.setAttribute(attribute, value);
  document.head.appendChild(meta);
}

export function Seo({
  title,
  description,
  path,
  image = DEFAULT_IMAGE,
  noindex = false,
  type = "website",
  structuredData,
}: SeoProps) {
  useEffect(() => {
    const pageTitle = `${title} | ${SITE_NAME}`;
    const canonicalUrl = new URL(path ?? window.location.pathname, window.location.origin).toString();
    const imageUrl = new URL(image, window.location.origin).toString();
    const robots = noindex ? "noindex,nofollow" : "index,follow,max-image-preview:large";

    document.title = pageTitle;

    updateMeta('meta[name="description"]', "content", description);
    updateMeta('meta[name="robots"]', "content", robots);
    updateMeta('meta[property="og:type"]', "content", type);
    updateMeta('meta[property="og:site_name"]', "content", SITE_NAME);
    updateMeta('meta[property="og:title"]', "content", pageTitle);
    updateMeta('meta[property="og:description"]', "content", description);
    updateMeta('meta[property="og:image"]', "content", imageUrl);
    updateMeta('meta[property="og:url"]', "content", canonicalUrl);
    updateMeta('meta[name="twitter:card"]', "content", "summary_large_image");
    updateMeta('meta[name="twitter:title"]', "content", pageTitle);
    updateMeta('meta[name="twitter:description"]', "content", description);
    updateMeta('meta[name="twitter:image"]', "content", imageUrl);
    updateMeta('link[rel="canonical"]', "href", canonicalUrl);

    const existingStructuredData = document.head.querySelector(`#${STRUCTURED_DATA_TAG_ID}`);
    if (existingStructuredData) {
      existingStructuredData.remove();
    }

    if (structuredData) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = STRUCTURED_DATA_TAG_ID;
      script.text = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }
  }, [description, image, noindex, path, structuredData, title, type]);

  return null;
}