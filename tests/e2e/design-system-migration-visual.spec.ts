import { expect, test, type Browser, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { handleNormalUserUi, signIn } from "./helpers";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "desktop", width: 1440, height: 1000 },
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
  return page.locator("main").screenshot({ animations: "disabled", timeout: 45_000 });
}

async function captureFullPage(
  page: Page,
  path: string,
  viewport: (typeof VIEWPORTS)[number],
) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(path);
  await settle(page);
  return page.screenshot({ animations: "disabled", fullPage: true, timeout: 45_000 });
}

test("TripHub migration remains pixel-identical at contract reference viewports", async ({ browser }, testInfo) => {
  test.setTimeout(360_000);
  expect(CURRENT_URL, "KREW_E2E_BASE_URL must be configured").not.toBe("");

  const current = await openAuthenticatedPage(browser, CURRENT_URL);
  const tripId = await firstTripId(current.page);
  const before = BEFORE_URL ? await openAuthenticatedPage(browser, BEFORE_URL) : null;

  try {
    for (const viewport of VIEWPORTS) {
      const path = `/trips/${tripId}`;
      const currentScreenshot = await captureMain(current.page, path, viewport);
      await testInfo.attach(`after-${viewport.name}-trip-dashboard`, {
        body: currentScreenshot,
        contentType: "image/png",
      });

      if (!before) continue;

      const beforeScreenshot = await captureMain(before.page, path, viewport);
      await testInfo.attach(`before-${viewport.name}-trip-dashboard`, {
        body: beforeScreenshot,
        contentType: "image/png",
      });

      const snapshotName = `runtime-before-${viewport.name}-trip-dashboard.png`;
      const snapshotPath = testInfo.snapshotPath(snapshotName);
      mkdirSync(dirname(snapshotPath), { recursive: true });
      writeFileSync(snapshotPath, beforeScreenshot);

      expect(currentScreenshot).toMatchSnapshot(snapshotName, {
        threshold: 0,
        maxDiffPixels: 0,
      });
    }
  } finally {
    await current.context.close();
    await before?.context.close();
  }
});

test("Mes voyages migration remains pixel-identical at contract reference viewports", async ({ browser }, testInfo) => {
  test.setTimeout(360_000);
  expect(CURRENT_URL, "KREW_E2E_BASE_URL must be configured").not.toBe("");
  expect(BEFORE_URL, "KREW_E2E_BEFORE_URL must be configured for migration proof").not.toBe("");
  const current = await openAuthenticatedPage(browser, CURRENT_URL);
  const before = await openAuthenticatedPage(browser, BEFORE_URL);
  try {
    for (const viewport of VIEWPORTS) {
      const currentScreenshot = await captureMain(current.page, "/dashboard", viewport);
      await testInfo.attach(`after-${viewport.name}-mes-voyages`, { body: currentScreenshot, contentType: "image/png" });
      const beforeScreenshot = await captureMain(before.page, "/dashboard", viewport);
      await testInfo.attach(`before-${viewport.name}-mes-voyages`, { body: beforeScreenshot, contentType: "image/png" });
      const snapshotName = `runtime-before-${viewport.name}-mes-voyages.png`;
      const snapshotPath = testInfo.snapshotPath(snapshotName);
      mkdirSync(dirname(snapshotPath), { recursive: true });
      writeFileSync(snapshotPath, beforeScreenshot);
      expect(currentScreenshot).toMatchSnapshot(snapshotName, { threshold: 0, maxDiffPixels: 0 });
    }
  } finally {
    await current.context.close();
    await before.context.close();
  }
});

test("Nouveau voyage migration remains pixel-identical at contract reference viewports", async ({ browser }, testInfo) => {
  test.setTimeout(360_000);
  expect(CURRENT_URL, "KREW_E2E_BASE_URL must be configured").not.toBe("");
  expect(BEFORE_URL, "KREW_E2E_BEFORE_URL must be configured for migration proof").not.toBe("");
  const current = await openAuthenticatedPage(browser, CURRENT_URL);
  const before = await openAuthenticatedPage(browser, BEFORE_URL);
  try {
    for (const viewport of VIEWPORTS) {
      const currentScreenshot = await captureMain(current.page, "/trips/new", viewport);
      await testInfo.attach(`after-${viewport.name}-new-trip`, { body: currentScreenshot, contentType: "image/png" });
      const beforeScreenshot = await captureMain(before.page, "/trips/new", viewport);
      await testInfo.attach(`before-${viewport.name}-new-trip`, { body: beforeScreenshot, contentType: "image/png" });
      const snapshotName = `runtime-before-${viewport.name}-new-trip.png`;
      const snapshotPath = testInfo.snapshotPath(snapshotName);
      mkdirSync(dirname(snapshotPath), { recursive: true });
      writeFileSync(snapshotPath, beforeScreenshot);
      expect(currentScreenshot).toMatchSnapshot(snapshotName, { threshold: 0, maxDiffPixels: 0 });
    }
  } finally {
    await current.context.close();
    await before.context.close();
  }
});

test("Packing shell remains pixel-identical at contract reference viewports", async ({ browser }, testInfo) => {
  test.setTimeout(360_000);
  expect(CURRENT_URL, "KREW_E2E_BASE_URL must be configured").not.toBe("");
  expect(BEFORE_URL, "KREW_E2E_BEFORE_URL must be configured for migration proof").not.toBe("");
  const current = await openAuthenticatedPage(browser, CURRENT_URL);
  const tripId = await firstTripId(current.page);
  const before = await openAuthenticatedPage(browser, BEFORE_URL);

  try {
    for (const viewport of VIEWPORTS) {
      const path = `/trips/${tripId}/packing`;
      const currentScreenshot = await captureMain(current.page, path, viewport);
      await testInfo.attach(`after-${viewport.name}-packing`, {
        body: currentScreenshot,
        contentType: "image/png",
      });

      const beforeScreenshot = await captureMain(before.page, path, viewport);
      await testInfo.attach(`before-${viewport.name}-packing`, {
        body: beforeScreenshot,
        contentType: "image/png",
      });

      const snapshotName = `runtime-before-${viewport.name}-packing.png`;
      const snapshotPath = testInfo.snapshotPath(snapshotName);
      mkdirSync(dirname(snapshotPath), { recursive: true });
      writeFileSync(snapshotPath, beforeScreenshot);

      expect(currentScreenshot).toMatchSnapshot(snapshotName, {
        threshold: 0,
        maxDiffPixels: 0,
      });
    }
  } finally {
    await current.context.close();
    await before.context.close();
  }
});

test("Dates shell remains pixel-identical at contract reference viewports", async ({ browser }, testInfo) => {
  test.setTimeout(360_000);
  expect(CURRENT_URL, "KREW_E2E_BASE_URL must be configured").not.toBe("");
  expect(BEFORE_URL, "KREW_E2E_BEFORE_URL must be configured for migration proof").not.toBe("");
  const current = await openAuthenticatedPage(browser, CURRENT_URL);
  const tripId = await firstTripId(current.page);
  const before = await openAuthenticatedPage(browser, BEFORE_URL);

  try {
    for (const viewport of VIEWPORTS) {
      const path = `/trips/${tripId}/dates`;
      const currentScreenshot = await captureFullPage(current.page, path, viewport);
      await testInfo.attach(`after-${viewport.name}-dates`, {
        body: currentScreenshot,
        contentType: "image/png",
      });

      const beforeScreenshot = await captureFullPage(before.page, path, viewport);
      await testInfo.attach(`before-${viewport.name}-dates`, {
        body: beforeScreenshot,
        contentType: "image/png",
      });

      const snapshotName = `runtime-before-${viewport.name}-dates.png`;
      const snapshotPath = testInfo.snapshotPath(snapshotName);
      mkdirSync(dirname(snapshotPath), { recursive: true });
      writeFileSync(snapshotPath, beforeScreenshot);

      expect(currentScreenshot).toMatchSnapshot(snapshotName, {
        threshold: 0,
        maxDiffPixels: 0,
      });
    }
  } finally {
    await current.context.close();
    await before.context.close();
  }
});

test("Profile shell remains pixel-identical at contract reference viewports", async ({ browser }, testInfo) => {
  test.setTimeout(360_000);
  expect(CURRENT_URL, "KREW_E2E_BASE_URL must be configured").not.toBe("");
  expect(BEFORE_URL, "KREW_E2E_BEFORE_URL must be configured for migration proof").not.toBe("");
  const current = await openAuthenticatedPage(browser, CURRENT_URL);
  const tripId = await firstTripId(current.page);
  const before = await openAuthenticatedPage(browser, BEFORE_URL);

  try {
    for (const viewport of VIEWPORTS) {
      const path = `/trips/${tripId}/profile`;
      const currentScreenshot = await captureMain(current.page, path, viewport);
      await testInfo.attach(`after-${viewport.name}-profile`, {
        body: currentScreenshot,
        contentType: "image/png",
      });

      const beforeScreenshot = await captureMain(before.page, path, viewport);
      await testInfo.attach(`before-${viewport.name}-profile`, {
        body: beforeScreenshot,
        contentType: "image/png",
      });

      const snapshotName = `runtime-before-${viewport.name}-profile.png`;
      const snapshotPath = testInfo.snapshotPath(snapshotName);
      mkdirSync(dirname(snapshotPath), { recursive: true });
      writeFileSync(snapshotPath, beforeScreenshot);

      expect(currentScreenshot).toMatchSnapshot(snapshotName, {
        threshold: 0,
        maxDiffPixels: 0,
      });
    }
  } finally {
    await current.context.close();
    await before.context.close();
  }
});
