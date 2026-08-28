import { expect, test } from "@playwright/test";
import { handleNormalUserUi, signIn } from "./helpers";

const DISPOSABLE_TRIP_NAME = /E2E-(?:FULL|KREW)-\d{10,}/;
const TRIP_PATH = /^\/trips\/[0-9a-f-]{36}(?:[/?#]|$)/i;

test("cleanup disposable KREW E2E trips", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  test.skip(testInfo.project.name !== "mobile-safari", "Cleanup only needs to run once.");

  await signIn(page);
  await page.goto("/dashboard");
  await handleNormalUserUi(page);
  await expect(page.locator("main")).toBeVisible({ timeout: 20_000 });

  const candidates = await page.locator('a[href*="/trips/"]').evaluateAll((links) =>
    links.map((link) => ({
      href: (link as HTMLAnchorElement).getAttribute("href") || "",
      text: (link.textContent || "").replace(/\s+/g, " ").trim(),
    })),
  );

  const paths = [
    ...new Set(
      candidates
        .filter(({ href, text }) => TRIP_PATH.test(href) && DISPOSABLE_TRIP_NAME.test(text))
        .map(({ href }) => href.split("?")[0] || href),
    ),
  ];

  const deleted: string[] = [];
  const skipped: string[] = [];

  for (const path of paths) {
    await page.goto(path);
    await handleNormalUserUi(page);

    const remove = page.getByRole("button", { name: "Supprimer définitivement", exact: true });
    if (!(await remove.isVisible({ timeout: 10_000 }).catch(() => false))) {
      skipped.push(path);
      continue;
    }

    page.once("dialog", (dialog) => dialog.accept());
    await remove.click();
    await page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 30_000 });
    deleted.push(path);
  }

  await testInfo.attach("e2e-cleanup", {
    body: Buffer.from(JSON.stringify({ candidates: paths.length, deleted, skipped }, null, 2)),
    contentType: "application/json",
  });
});
