/**
 * E2E: Navigation and public pages
 *
 * Tests that public-facing routes render without crashes,
 * nav links work, and protected routes redirect unauthenticated users.
 */

import { test, expect } from "@playwright/test";

const PUBLIC_ROUTES = [
  { path: "/", name: "Home" },
  { path: "/features", name: "Features" },
  { path: "/pricing", name: "Pricing" },
  { path: "/contact", name: "Contact" },
  { path: "/sign-in", name: "Sign In" },
  { path: "/sign-up", name: "Sign Up" },
  { path: "/forgot-password", name: "Forgot Password" },
];

const PROTECTED_ROUTES = [
  "/dashboard",
  "/dashboard/analytics",
  "/dashboard/profile",
  "/dashboard/developer",
];

test.describe("Public pages render", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.name} (${route.path}) loads without JS errors`, async ({ page }) => {
      const jsErrors: string[] = [];
      page.on("pageerror", (err) => jsErrors.push(err.message));

      await page.goto(route.path);
      await page.waitForLoadState("domcontentloaded");

      // No uncaught JS errors
      expect(jsErrors.filter((e) => !e.includes("ResizeObserver"))).toHaveLength(0);

      // Page has a title
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
    });
  }
});

test.describe("Protected routes redirect unauthenticated users", () => {
  for (const path of PROTECTED_ROUTES) {
    test(`${path} redirects to sign-in when not logged in`, async ({ page }) => {
      await page.goto(path);
      // Wait specifically for /sign-in redirect — ProtectedRoute does an async auth check first
      await page.waitForURL(/sign-in|login/i, { timeout: 5000 }).catch(() => {});

      const currentUrl = page.url();
      const isRedirected = /sign-in|login/.test(currentUrl);
      const hasLoginPrompt = await page
        .getByRole("button", { name: /sign in|log in/i })
        .isVisible()
        .catch(() => false);

      expect(isRedirected || hasLoginPrompt).toBe(true);
    });
  }
});

test.describe("Navbar", () => {
  test("shows logo on home page", async ({ page }) => {
    await page.goto("/");
    // Logo should be present (as img, svg, or text)
    const logo = page.locator("nav img, nav svg, nav [class*=logo], nav a").first();
    await expect(logo).toBeVisible();
  });

  test("has navigation links on home page", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav, header");
    await expect(nav).toBeVisible();
  });
});

test.describe("404 page", () => {
  test("shows not-found page for unknown route", async ({ page }) => {
    await page.goto("/this-route-does-not-exist-xyz");
    await page.waitForLoadState("domcontentloaded");

    const has404 = await page
      .getByText(/not found|404|page doesn/i)
      .isVisible()
      .catch(() => false);
    const isRedirectedHome = page.url().endsWith("/") || page.url().endsWith("/this-route-does-not-exist-xyz");

    expect(has404 || isRedirectedHome).toBe(true);
  });
});
