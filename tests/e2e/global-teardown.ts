import { chromium } from "@playwright/test";
import { handleNormalUserUi, qa, signIn } from "./helpers";
import { DISPOSABLE_TRIP_NAME } from "./test-lifecycle";

const TRIP_PATH = /^\/trips\/([0-9a-f-]{36})(?:[/?#]|$)/i;

export default async function globalTeardown() {
  // Local unit-only work and misconfigured E2E runs should not fail again during teardown.
  if (!qa.email || !qa.password) return;

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: process.env.KREW_E2E_BASE_URL ?? "http://127.0.0.1:3000" });
  const page = await context.newPage();

  try {
    await signIn(page);
    await page.goto("/dashboard");
    await handleNormalUserUi(page);

    const candidates = await page.locator('a[href*="/trips/"]').evaluateAll((links) =>
      links.map((link) => ({
        href: (link as HTMLAnchorElement).getAttribute("href") || "",
        text: (link.textContent || "").replace(/\s+/g, " ").trim(),
      })),
    );

    const disposable = [...new Map(
      candidates
        .filter(({ href, text }) => TRIP_PATH.test(href) && DISPOSABLE_TRIP_NAME.test(text))
        .map(({ href, text }) => [href.match(TRIP_PATH)?.[1], { href, text }]),
    ).values()].filter(Boolean);

    for (const candidate of disposable) {
      const match = candidate.href.match(TRIP_PATH);
      if (!match?.[1]) continue;
      await page.goto(`/trips/${match[1]}`);
      await handleNormalUserUi(page);
      const remove = page.getByRole("button", { name: "Supprimer définitivement", exact: true });
      if (!(await remove.isVisible({ timeout: 10_000 }).catch(() => false))) continue;
      page.once("dialog", (dialog) => dialog.accept());
      await remove.click();
      await page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 30_000 });
    }
  } catch (error) {
    // Cleanup must never mask the actual test failure. The leak-guard test will expose leftovers next run.
    console.error("KREW E2E global cleanup failed:", error);
  } finally {
    await context.close();
    await browser.close();
  }
}
