import { expect, test, type Browser, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { handleNormalUserUi, signIn } from "./helpers";

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
] as const;

const CURRENT_URL = (process.env.KREW_E2E_BASE_URL ?? "").replace(/\/$/, "");
const BEFORE_URL = (process.env.KREW_E2E_BEFORE_URL ?? "").replace(/\/$/, "");

async function settle(page: Page) {
  await handleNormalUserUi(page);
  await expect(page.locator("main")).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready).catch(() => undefined);
  await page.addStyleTag({
    content: `
      html { scroll-behavior: auto !important; }
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `,
  });
  await page.waitForTimeout(250);
}

async function firstTripId(page: Page) {
  await page.goto("/dashboard");
  await settle(page);
  const hrefs = await page.locator('a[href*="/trips/"]').evaluateAll((links) =>
    links.map((link) => (link as HTMLAnchorElement).getAttribute("href") || ""),
  );
  for (const href of hrefs) {
    const match = href.match(/\/trips\/([0-9a-f-]{36})(?:[/?#]|$)/i);
    if (match?.[1]) return match[1];
  }
  throw new Error("Design-system visual audit needs at least one trip on the QA account");
}

async function openAuthenticatedPage(browser: Browser, baseURL: string) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await signIn(page);
  return { context, page };
}

async function captureMain(
  page: Page,
  path: string,
  viewport: (typeof VIEWPORTS)[number],
) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(path);
  await settle(page);
  return page.locator("main").screenshot({ animations: "disabled" });
}

test("design-system migration surfaces remain pixel-identical", async ({ browser }, testInfo) => {
  test.setTimeout(360_000);
  expect(CURRENT_URL, "KREW_E2E_BASE_URL must be configured").not.toBe("");

  const current = await openAuthenticatedPage(browser, CURRENT_URL);
  const tripId = await firstTripId(current.page);

  const before = BEFORE_URL ? await openAuthenticatedPage(browser, BEFORE_URL) : null;
  const surfaces = [
    { name: "trip-dashboard", path: `/trips/${tripId}` },
    { name: "mes-voyages", path: "/dashboard" },
    { name: "nouveau-voyage", path: "/trips/new" },
  ] as const;

  try {
    for (const viewport of VIEWPORTS) {
      for (const surface of surfaces) {
        const currentScreenshot = await captureMain(current.page, surface.path, viewport);
        await testInfo.attach(`after-${viewport.name}-${surface.name}`, {
          body: currentScreenshot,
          contentType: "image/png",
        });

        if (!before) continue;

        const beforeScreenshot = await captureMain(before.page, surface.path, viewport);
        await testInfo.attach(`before-${viewport.name}-${surface.name}`, {
          body: beforeScreenshot,
          contentType: "image/png",
        });

        const snapshotName = `runtime-before-${viewport.name}-${surface.name}.png`;
        const snapshotPath = testInfo.snapshotPath(snapshotName);
        mkdirSync(dirname(snapshotPath), { recursive: true });
        writeFileSync(snapshotPath, beforeScreenshot);

        expect(currentScreenshot).toMatchSnapshot(snapshotName, {
          threshold: 0,
          maxDiffPixels: 0,
        });
      }
    }
  } finally {
    await current.context.close();
    await before?.context.close();
  }
});
