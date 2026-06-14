/**
 * Headless rendering for JS-rendered (SPA) websites.
 *
 * Problem: Many modern sites (React/Vue/Next CSR) ship an empty `<div id="root">`
 * shell — a plain `fetch` + cheerio sees no content, so the crawler throws
 * URL_CRAWL_EMPTY even though the page is full of text once JS runs.
 *
 * Solution: When static extraction is too thin, render the page with a real
 * Chromium (Playwright) and return the post-render HTML. Playwright is imported
 * lazily so a missing browser binary degrades gracefully (returns null) instead
 * of crashing the whole backend.
 *
 * A single shared browser instance is reused across renders and closed on
 * graceful shutdown (see server.ts).
 */

import type { Browser } from "playwright";
import { logger } from "../../config/logger.js";

const RENDER_NAV_TIMEOUT_MS = 20_000;
const RENDER_NETWORKIDLE_TIMEOUT_MS = 8_000;
const RENDER_SETTLE_MS = 600;

let sharedBrowser: Browser | null = null;
let launching: Promise<Browser> | null = null;

async function launchBrowser(): Promise<Browser> {
  const { chromium } = await import("playwright");
  return chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });
}

async function getBrowser(): Promise<Browser> {
  if (sharedBrowser && sharedBrowser.isConnected()) {
    return sharedBrowser;
  }
  if (!launching) {
    launching = launchBrowser()
      .then((browser) => {
        sharedBrowser = browser;
        logger.info("Headless render browser launched");
        return browser;
      })
      .finally(() => {
        launching = null;
      });
  }
  return launching;
}

/**
 * Render `url` in a headless browser and return the fully-rendered HTML.
 * Returns `null` if rendering is unavailable or fails — callers should fall
 * back to static extraction.
 */
export async function renderPageHtml(url: string, userAgent: string): Promise<string | null> {
  try {
    const browser = await getBrowser();
    const context = await browser.newContext({
      userAgent,
      locale: "en-US",
      javaScriptEnabled: true,
    });
    try {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: RENDER_NAV_TIMEOUT_MS });
      // Best-effort wait for client-side data fetches to settle; ignore timeout.
      await page
        .waitForLoadState("networkidle", { timeout: RENDER_NETWORKIDLE_TIMEOUT_MS })
        .catch(() => undefined);
      await page.waitForTimeout(RENDER_SETTLE_MS);
      return await page.content();
    } finally {
      await context.close().catch(() => undefined);
    }
  } catch (error) {
    logger.warn({ url, error: (error as Error).message }, "Headless render failed");
    return null;
  }
}

/** Close the shared browser. Call from graceful shutdown. */
export async function closeRenderBrowser(): Promise<void> {
  const browser = sharedBrowser;
  sharedBrowser = null;
  if (browser) {
    await browser.close().catch(() => undefined);
  }
}
