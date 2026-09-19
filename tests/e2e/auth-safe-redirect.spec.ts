import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("an authenticated user cannot be redirected off-origin by auth next", async ({ page }) => {
  await signIn(page);
  const expectedOrigin = new URL(page.url()).origin;

  await page.goto(`/auth?next=${encodeURIComponent("/\\\\evil.com")}`);
  await page.waitForURL(/\/dashboard(?:\?|$)/);

  const current = new URL(page.url());
  expect(current.origin).toBe(expectedOrigin);
  expect(current.pathname).toBe("/dashboard");
});
