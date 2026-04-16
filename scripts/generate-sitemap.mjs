import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const APP_FILE = resolve(ROOT, "src", "App.tsx");
const OUTPUT_FILE = resolve(ROOT, "public", "sitemap.xml");
const SITE_URL = (process.env.SITE_URL || "https://voxflow-ai-site.vercel.app").replace(/\/+$/, "");

const ROUTE_REGEX = /<Route\s+path="([^"]+)"/g;

const EXCLUDED_EXACT = new Set([
  "*",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/stripe-success",
  "/stripe-cancel",
]);

const EXCLUDED_PREFIXES = ["/dashboard", "/conversation"];

function isIndexableRoute(path) {
  if (!path.startsWith("/")) return false;
  if (path.includes(":")) return false;
  if (EXCLUDED_EXACT.has(path)) return false;
  return !EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function priorityFor(path) {
  if (path === "/") return "1.0";
  if (["/features", "/how-it-works", "/pricing"].includes(path)) return "0.9";
  if (path === "/faq") return "0.8";
  return "0.7";
}

function changefreqFor(path) {
  if (["/", "/features", "/how-it-works", "/pricing", "/faq"].includes(path)) return "weekly";
  return "monthly";
}

function getPublicRoutes(appSource) {
  const matches = [...appSource.matchAll(ROUTE_REGEX)].map((match) => match[1]);
  const unique = [...new Set(matches)];
  return unique.filter(isIndexableRoute).sort((a, b) => {
    if (a === "/") return -1;
    if (b === "/") return 1;
    return a.localeCompare(b);
  });
}

function buildSitemapXml(routes) {
  const urlEntries = routes
    .map((path) => {
      const loc = `${SITE_URL}${path}`;
      return [
        "  <url>",
        `    <loc>${loc}</loc>`,
        `    <changefreq>${changefreqFor(path)}</changefreq>`,
        `    <priority>${priorityFor(path)}</priority>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urlEntries,
    "</urlset>",
    "",
  ].join("\n");
}

function main() {
  const appSource = readFileSync(APP_FILE, "utf8");
  const routes = getPublicRoutes(appSource);
  const xml = buildSitemapXml(routes);
  writeFileSync(OUTPUT_FILE, xml, "utf8");

  console.log(`[sitemap] Generated ${routes.length} routes -> public/sitemap.xml`);
}

main();
