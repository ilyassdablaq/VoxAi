import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const APP_FILE = resolve(ROOT, "src", "App.tsx");
const SITEMAP_FILE = resolve(ROOT, "public", "sitemap.xml");
const ROBOTS_FILE = resolve(ROOT, "public", "robots.txt");
const SITE_URL = (process.env.SITE_URL || "https://voxflow-ai-site.vercel.app").replace(/\/+$/, "");

const ROUTE_REGEX = /<Route\s+path="([^"]+)"/g;
const LOC_REGEX = /<loc>([^<]+)<\/loc>/g;

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

function getPublicRoutes(appSource) {
  const matches = [...appSource.matchAll(ROUTE_REGEX)].map((match) => match[1]);
  const unique = [...new Set(matches)];
  return unique.filter(isIndexableRoute).sort((a, b) => {
    if (a === "/") return -1;
    if (b === "/") return 1;
    return a.localeCompare(b);
  });
}

function getSitemapRoutes(sitemapSource) {
  const locs = [...sitemapSource.matchAll(LOC_REGEX)].map((match) => match[1]);
  return locs
    .filter((loc) => loc.startsWith(SITE_URL))
    .map((loc) => {
      const route = loc.slice(SITE_URL.length) || "/";
      return route.startsWith("/") ? route : `/${route}`;
    })
    .sort((a, b) => {
      if (a === "/") return -1;
      if (b === "/") return 1;
      return a.localeCompare(b);
    });
}

function hasRobotsDisallow(robotsSource, route) {
  const disallowLine = `Disallow: ${route}`;
  return robotsSource
    .split(/\r?\n/)
    .map((line) => line.trim())
    .includes(disallowLine);
}

function unique(list) {
  return [...new Set(list)];
}

function diff(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);

  return {
    missing: expected.filter((item) => !actualSet.has(item)),
    unexpected: actual.filter((item) => !expectedSet.has(item)),
  };
}

function main() {
  const appSource = readFileSync(APP_FILE, "utf8");
  const sitemapSource = readFileSync(SITEMAP_FILE, "utf8");
  const robotsSource = readFileSync(ROBOTS_FILE, "utf8");

  const expectedPublicRoutes = unique(getPublicRoutes(appSource));
  const actualSitemapRoutes = unique(getSitemapRoutes(sitemapSource));

  const sitemapDiff = diff(expectedPublicRoutes, actualSitemapRoutes);

  const expectedPrivateDisallow = [
    "/dashboard",
    "/dashboard/",
    "/conversation/",
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/reset-password",
    "/stripe-success",
    "/stripe-cancel",
    "/api/",
  ];

  const missingDisallow = expectedPrivateDisallow.filter((route) => !hasRobotsDisallow(robotsSource, route));

  const expectedSitemapLine = `Sitemap: ${SITE_URL}/sitemap.xml`;
  const hasSitemapLine = robotsSource.includes(expectedSitemapLine);

  const expectedHostLine = `Host: ${SITE_URL}`;
  const hasHostLine = robotsSource.includes(expectedHostLine);

  const errors = [];

  if (sitemapDiff.missing.length || sitemapDiff.unexpected.length) {
    errors.push("Sitemap route mismatch detected.");
    if (sitemapDiff.missing.length) {
      errors.push(`Missing routes in sitemap: ${sitemapDiff.missing.join(", ")}`);
    }
    if (sitemapDiff.unexpected.length) {
      errors.push(`Unexpected routes in sitemap: ${sitemapDiff.unexpected.join(", ")}`);
    }
  }

  if (missingDisallow.length) {
    errors.push(`robots.txt missing Disallow lines: ${missingDisallow.join(", ")}`);
  }

  if (!hasSitemapLine) {
    errors.push(`robots.txt missing sitemap line: ${expectedSitemapLine}`);
  }

  if (!hasHostLine) {
    errors.push(`robots.txt missing host line: ${expectedHostLine}`);
  }

  if (errors.length) {
    console.error("[seo:check] FAILED");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("[seo:check] OK");
  console.log(`- Public routes checked: ${expectedPublicRoutes.length}`);
  console.log(`- Sitemap routes checked: ${actualSitemapRoutes.length}`);
  console.log(`- robots.txt directives validated: ${expectedPrivateDisallow.length + 2}`);
}

main();
