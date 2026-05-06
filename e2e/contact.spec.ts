/**
 * E2E: Contact form
 *
 * Tests form rendering, validation, and submission behaviour.
 */

import { test, expect } from "@playwright/test";

test.describe("Contact page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/contact");
  });

  test("renders the contact form", async ({ page }) => {
    await expect(page.locator('input[placeholder*="name" i], input[name*="name" i]').first()).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator("textarea")).toBeVisible();
    await expect(page.getByRole("button", { name: /send|submit|contact/i })).toBeVisible();
  });

  test("shows validation error when submitting empty form", async ({ page }) => {
    await page.getByRole("button", { name: /send|submit|contact/i }).click();
    await page.waitForTimeout(500);

    // Either browser validation (invalid inputs) or app-level error messages
    const nameInput = page.locator('input[placeholder*="name" i], input[name*="name" i]').first();
    const isInvalid = await nameInput.evaluate((el: HTMLInputElement) => !el.validity.valid).catch(() => false);
    const hasErrors = await page.locator('[role="alert"], .error, [data-error]').isVisible().catch(() => false);

    expect(isInvalid || hasErrors).toBe(true);
  });

  test("accepts valid form input without crashing", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('input[placeholder*="name" i], input[name*="name" i]').first().fill("Test User");
    await page.locator('input[type="email"]').fill("test@example.com");

    const messageField = page.locator("textarea").first();
    await messageField.fill("This is a test message from Playwright E2E suite.");

    expect(jsErrors).toHaveLength(0);
  });
});
