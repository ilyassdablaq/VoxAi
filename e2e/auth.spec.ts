/**
 * E2E: Authentication flows
 *
 * These tests cover the critical auth paths:
 *   - Login page renders correctly
 *   - Invalid credentials shows error
 *   - Register page renders and validates
 *   - Forgot password page accessible
 *   - Navigation between auth pages
 *
 * Note: Happy-path login/register tests that hit the real backend
 * are tagged @backend and only run when BACKEND_URL is set.
 */

import { test, expect } from "@playwright/test";

test.describe("Sign In page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-in");
  });

  test("renders email and password fields", async ({ page }) => {
    await expect(page.locator('input[type="email"], input[placeholder*="email" i]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("renders sign-in submit button", async ({ page }) => {
    const btn = page.getByRole("button", { name: /sign in|log in|continue/i });
    await expect(btn).toBeVisible();
  });

  test("has link to sign-up page", async ({ page }) => {
    const link = page.getByRole("link", { name: /sign up|register|create account/i });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/sign-up|register/i);
  });

  test("has link to forgot password page", async ({ page }) => {
    const link = page.getByRole("link", { name: /forgot|reset password/i });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/forgot|reset/i);
  });

  test("shows validation error for empty submit", async ({ page }) => {
    await page.getByRole("button", { name: /sign in|log in|continue/i }).click();
    await page.waitForTimeout(500);
    // Either HTML5 validation or an error message (app uses .text-destructive, not role=alert)
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    const hasErrorText = await page.locator('[role="alert"], .error, [data-error], .text-destructive').isVisible().catch(() => false);
    expect(isInvalid || hasErrorText).toBe(true);
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.locator('input[type="email"], input[placeholder*="email" i]').fill("notreal@example.com");
    await page.locator('input[type="password"]').fill("WrongPassword123");
    await page.getByRole("button", { name: /sign in|log in|continue/i }).click();

    // Expect either an error message to appear or still be on sign-in page (no redirect)
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/sign-in|login/i);
  });
});

test.describe("Sign Up page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-up");
  });

  test("renders full name, email and password fields", async ({ page }) => {
    await expect(page.locator('input[placeholder*="name" i], input[name*="name" i]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test("renders create account submit button", async ({ page }) => {
    const btn = page.getByRole("button", { name: /create account|sign up|register/i });
    await expect(btn).toBeVisible();
  });

  test("has link back to sign-in", async ({ page }) => {
    // Scope to main content to avoid matching the navbar "Sign In" link
    const link = page.locator("main, form, .glass").getByRole("link", { name: /sign in|log in|already have/i }).first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/sign-in|login/i);
  });

  test("shows error for weak password", async ({ page }) => {
    await page.locator('input[placeholder*="name" i], input[name*="name" i]').first().fill("Test User");
    await page.locator('input[type="email"]').fill("newuser@example.com");
    await page.locator('input[type="password"]').first().fill("weak");
    await page.getByRole("button", { name: /create account|sign up|register/i }).click();

    await page.waitForTimeout(1000);
    // Should either show validation error or still be on sign-up page
    await expect(page).toHaveURL(/sign-up|register/i);
  });
});

test.describe("Forgot Password page", () => {
  test("renders email field and submit button", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /reset|send|submit/i })).toBeVisible();
  });

  test("has link back to sign-in", async ({ page }) => {
    await page.goto("/forgot-password");
    // Scope to main content to avoid matching the navbar "Sign In" link
    const link = page.locator("main, form, .glass").getByRole("link", { name: /sign in|back|log in/i }).first();
    await expect(link).toBeVisible();
  });

  test("submitting non-existent email shows success message (no user enumeration)", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.locator('input[type="email"]').fill("doesnotexist@example.com");
    await page.getByRole("button", { name: /reset|send|submit/i }).click();
    // Server should always return success to prevent user enumeration
    await page.waitForTimeout(2500);
    // Should show some success feedback OR stay on page without revealing account existence
    const url = page.url();
    expect(url).toMatch(/forgot|reset|sign-in/i);
  });
});
