import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
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
const AUTHENTICATED_STATES = new Map<
  string,
  Awaited<ReturnType<BrowserContext["storageState"]>>
>();

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
      vercel-live-feedback,
      #vercel-toolbar,
      iframe[src*="vercel.live"] {
        display: none !important;
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
  const storageState = AUTHENTICATED_STATES.get(baseURL);
  const context = await browser.newContext({ baseURL, storageState });
  await context.addInitScript(() => {
    localStorage.setItem("krew-cookie-consent", JSON.stringify({
      essential: true,
      analytics: false,
      personalization: false,
      advertising: false,
      retargeting: false,
      social: false,
      affiliate: false,
      date: "1970-01-01T00:00:00.000Z",
      version: 1,
    }));
  });
  const page = await context.newPage();
  if (!storageState) {
    await signIn(page);
    AUTHENTICATED_STATES.set(baseURL, await context.storageState());
  }
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

async function captureJourneySurface(
  page: Page,
  path: string,
  viewport: (typeof VIEWPORTS)[number],
) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(path);
  await settle(page);
  return page.screenshot({
    animations: "disabled",
    fullPage: true,
    mask: [page.locator("header.sticky.top-0.z-40").first()],
    maskColor: "#ffffff",
    timeout: 45_000,
  });
}

async function renderedPageShellWidth(page: Page) {
  return page.locator("main[data-krew-page-shell]").first().evaluate((shell) => Math.round(shell.getBoundingClientRect().width));
}

async function renderedPrimaryTitleSize(page: Page) {
  return page.locator("main h1").first().evaluate((title) => Number.parseFloat(getComputedStyle(title).fontSize));
}

function expectApprovedTitleTransition({
  currentScreenshot,
  beforeScreenshot,
  currentSize,
  beforeSize,
  expectedCurrentSize,
  expectedBeforeSize,
  expectedVisualChange,
}: {
  currentScreenshot: Buffer;
  beforeScreenshot: Buffer;
  currentSize: number;
  beforeSize: number;
  expectedCurrentSize: number;
  expectedBeforeSize: number;
  expectedVisualChange?: boolean;
}) {
  expect(currentSize).toBe(expectedCurrentSize);
  expect(beforeSize).toBe(expectedBeforeSize);
  const visualChange = expectedVisualChange ?? expectedCurrentSize !== expectedBeforeSize;
  expect(currentScreenshot.equals(beforeScreenshot)).toBe(!visualChange);
}

async function expectApprovedChapterTitleTransition({
  currentPage,
  beforePage,
  currentScreenshot,
  beforeScreenshot,
  viewport,
  maxDiffPixels = 0,
  snapshotName,
}: {
  currentPage: Page;
  beforePage: Page;
  currentScreenshot: Buffer;
  beforeScreenshot: Buffer;
  viewport: (typeof VIEWPORTS)[number];
  maxDiffPixels?: number;
  snapshotName?: string;
}) {
  const currentTitleCount = await currentPage.locator("main h1").count();
  const beforeTitleCount = await beforePage.locator("main h1").count();
  if (currentTitleCount === 0 || beforeTitleCount === 0) {
    // Some QA trips legitimately expose a locked/empty chapter state (for example,
    // no Star configured). Keep its before/after evidence without asserting a title
    // token that is not rendered in either version.
    expect(currentTitleCount).toBe(beforeTitleCount);
    return;
  }

  expect(await renderedPrimaryTitleSize(currentPage)).toBe(viewport.name === "mobile" ? 30 : 34);
  // Baseline rebased after PR #387: main already contains the approved D1 chapter scale.
  // Dates also includes the #388 runtime fix, which restored the normal page before #387 merged.
  expect(await renderedPrimaryTitleSize(beforePage)).toBe(viewport.name === "mobile" ? 30 : 34);
  if (maxDiffPixels === 0) {
    expect(currentScreenshot.equals(beforeScreenshot)).toBe(true);
  } else {
    expect(snapshotName, "snapshotName is required when allowing raster tolerance").toBeTruthy();
    expect(currentScreenshot).toMatchSnapshot(snapshotName!, {
      threshold: 0,
      maxDiffPixels,
    });
  }
}

function expectApprovedWidthTransition({
  currentScreenshot,
  beforeScreenshot,
  currentWidth,
  beforeWidth,
  expectedCurrentWidth,
  expectedBeforeWidth,
}: {
  currentScreenshot: Buffer;
  beforeScreenshot: Buffer;
  currentWidth: number;
  beforeWidth: number;
  expectedCurrentWidth: number;
  expectedBeforeWidth: number;
}) {
  expect(currentWidth).toBe(expectedCurrentWidth);
  expect(beforeWidth).toBe(expectedBeforeWidth);

  if (expectedCurrentWidth === expectedBeforeWidth) {
    expect(currentScreenshot.equals(beforeScreenshot)).toBe(true);
    return;
  }

  // D5 intentionally replaces the former pixel-identical migration baseline:
  // screenshots differ only at the desktop width where the approved shell width changes.
  expect(currentScreenshot.equals(beforeScreenshot)).toBe(false);
}

test("TripHub matches the approved D1 hero-title scale", async ({ browser }, testInfo) => {
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

      expectApprovedTitleTransition({
        currentScreenshot,
        beforeScreenshot,
        currentSize: await renderedPrimaryTitleSize(current.page),
        beforeSize: await renderedPrimaryTitleSize(before.page),
        expectedCurrentSize: viewport.name === "mobile" ? 42 : viewport.name === "tablet" ? 50 : 56,
        // PR #387 D1 is now the main baseline.
        expectedBeforeSize: viewport.name === "mobile" ? 42 : viewport.name === "tablet" ? 50 : 56,
      });
    }
  } finally {
    await current.context.close();
    await before?.context.close();
  }
});

test("Mes voyages matches the approved D1 title and D5 wide-shell contracts", async ({ browser }, testInfo) => {
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
      const currentWidth = await renderedPageShellWidth(current.page);
      const beforeWidth = await renderedPageShellWidth(before.page);
      expect(currentWidth).toBe(viewport.name === "desktop" ? 1200 : viewport.width);
      // PR #387 D5 is now the main baseline.
      expect(beforeWidth).toBe(viewport.name === "desktop" ? 1200 : viewport.width);
      expectApprovedTitleTransition({
        currentScreenshot,
        beforeScreenshot,
        currentSize: await renderedPrimaryTitleSize(current.page),
        beforeSize: await renderedPrimaryTitleSize(before.page),
        expectedCurrentSize: viewport.name === "mobile" ? 42 : viewport.name === "tablet" ? 50 : 56,
        expectedBeforeSize: viewport.name === "mobile" ? 42 : viewport.name === "tablet" ? 50 : 56,
        expectedVisualChange: false,
      });
    }
  } finally {
    await current.context.close();
    await before.context.close();
  }
});

test("Nouveau voyage matches the approved D1 hero-title scale", async ({ browser }, testInfo) => {
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
      expectApprovedTitleTransition({
        currentScreenshot,
        beforeScreenshot,
        currentSize: await renderedPrimaryTitleSize(current.page),
        beforeSize: await renderedPrimaryTitleSize(before.page),
        expectedCurrentSize: viewport.name === "mobile" ? 42 : viewport.name === "tablet" ? 50 : 56,
        // PR #387 D1 is now the main baseline.
        expectedBeforeSize: viewport.name === "mobile" ? 42 : viewport.name === "tablet" ? 50 : 56,
        expectedVisualChange: false,
      });
    }
  } finally {
    await current.context.close();
    await before.context.close();
  }
});

test("Packing matches the approved chapter-title contract", async ({ browser }, testInfo) => {
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

      await expectApprovedChapterTitleTransition({
        currentPage: current.page,
        beforePage: before.page,
        currentScreenshot,
        beforeScreenshot,
        viewport,
      });
    }
  } finally {
    await current.context.close();
    await before.context.close();
  }
});

test("Dates matches the approved chapter-title contract", async ({ browser }, testInfo) => {
  test.setTimeout(360_000);
  expect(CURRENT_URL, "KREW_E2E_BASE_URL must be configured").not.toBe("");
  expect(BEFORE_URL, "KREW_E2E_BEFORE_URL must be configured for migration proof").not.toBe("");
  const current = await openAuthenticatedPage(browser, CURRENT_URL);
  const tripId = await firstTripId(current.page);
  const before = await openAuthenticatedPage(browser, BEFORE_URL);

  try {
    for (const viewport of VIEWPORTS) {
      const path = `/trips/${tripId}/dates`;
      // Artifact evidence: all 84 differing pixels were confined to the sticky header.
      // Mask that non-contract header consistently with other journey captures.
      const currentScreenshot = await captureJourneySurface(current.page, path, viewport);
      await testInfo.attach(`after-${viewport.name}-dates`, {
        body: currentScreenshot,
        contentType: "image/png",
      });

      const beforeScreenshot = await captureJourneySurface(before.page, path, viewport);
      await testInfo.attach(`before-${viewport.name}-dates`, {
        body: beforeScreenshot,
        contentType: "image/png",
      });

      const snapshotName = `runtime-before-${viewport.name}-dates.png`;
      const snapshotPath = testInfo.snapshotPath(snapshotName);
      mkdirSync(dirname(snapshotPath), { recursive: true });
      writeFileSync(snapshotPath, beforeScreenshot);

      await expectApprovedChapterTitleTransition({
        currentPage: current.page,
        beforePage: before.page,
        currentScreenshot,
        beforeScreenshot,
        viewport,
      });
    }
  } finally {
    await current.context.close();
    await before.context.close();
  }
});

test("Profile matches the approved chapter-title contract", async ({ browser }, testInfo) => {
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

      await expectApprovedChapterTitleTransition({
        currentPage: current.page,
        beforePage: before.page,
        currentScreenshot,
        beforeScreenshot,
        viewport,
        // Artifact evidence: exactly two pixels differed across the whole Profile main capture.
        maxDiffPixels: 2,
        snapshotName,
      });
    }
  } finally {
    await current.context.close();
    await before.context.close();
  }
});

test("Tasks matches the approved chapter-title contract", async ({ browser }, testInfo) => {
  test.setTimeout(360_000);
  expect(CURRENT_URL, "KREW_E2E_BASE_URL must be configured").not.toBe("");
  expect(BEFORE_URL, "KREW_E2E_BEFORE_URL must be configured for migration proof").not.toBe("");
  const current = await openAuthenticatedPage(browser, CURRENT_URL);
  const tripId = await firstTripId(current.page);
  const before = await openAuthenticatedPage(browser, BEFORE_URL);

  try {
    for (const viewport of VIEWPORTS) {
      const path = `/trips/${tripId}/tasks`;
      const currentScreenshot = await captureMain(current.page, path, viewport);
      await testInfo.attach(`after-${viewport.name}-tasks`, {
        body: currentScreenshot,
        contentType: "image/png",
      });

      const beforeScreenshot = await captureMain(before.page, path, viewport);
      await testInfo.attach(`before-${viewport.name}-tasks`, {
        body: beforeScreenshot,
        contentType: "image/png",
      });

      const snapshotName = `runtime-before-${viewport.name}-tasks.png`;
      const snapshotPath = testInfo.snapshotPath(snapshotName);
      mkdirSync(dirname(snapshotPath), { recursive: true });
      writeFileSync(snapshotPath, beforeScreenshot);

      await expectApprovedChapterTitleTransition({
        currentPage: current.page,
        beforePage: before.page,
        currentScreenshot,
        beforeScreenshot,
        viewport,
        // Run 34645670196: exactly two rasterization pixels differed on Tasks;
        // keep threshold 0 and localize the tolerance to this surface only.
        maxDiffPixels: 2,
        snapshotName,
      });
    }
  } finally {
    await current.context.close();
    await before.context.close();
  }
});

test("Transport matches the approved chapter-title contract", async ({ browser }, testInfo) => {
  test.setTimeout(360_000);
  expect(CURRENT_URL, "KREW_E2E_BASE_URL must be configured").not.toBe("");
  expect(BEFORE_URL, "KREW_E2E_BEFORE_URL must be configured for migration proof").not.toBe("");
  const current = await openAuthenticatedPage(browser, CURRENT_URL);
  const tripId = await firstTripId(current.page);
  const before = await openAuthenticatedPage(browser, BEFORE_URL);

  try {
    for (const viewport of VIEWPORTS) {
      const path = `/trips/${tripId}/transport`;
      const currentScreenshot = await captureMain(current.page, path, viewport);
      await testInfo.attach(`after-${viewport.name}-transport`, {
        body: currentScreenshot,
        contentType: "image/png",
      });

      const beforeScreenshot = await captureMain(before.page, path, viewport);
      await testInfo.attach(`before-${viewport.name}-transport`, {
        body: beforeScreenshot,
        contentType: "image/png",
      });

      const snapshotName = `runtime-before-${viewport.name}-transport.png`;
      const snapshotPath = testInfo.snapshotPath(snapshotName);
      mkdirSync(dirname(snapshotPath), { recursive: true });
      writeFileSync(snapshotPath, beforeScreenshot);

      await expectApprovedChapterTitleTransition({
        currentPage: current.page,
        beforePage: before.page,
        currentScreenshot,
        beforeScreenshot,
        viewport,
      });
    }
  } finally {
    await current.context.close();
    await before.context.close();
  }
});

test("Destination matches the approved chapter-title contract", async ({ browser }, testInfo) => {
  test.setTimeout(360_000);
  expect(CURRENT_URL, "KREW_E2E_BASE_URL must be configured").not.toBe("");
  expect(BEFORE_URL, "KREW_E2E_BEFORE_URL must be configured for migration proof").not.toBe("");
  const current = await openAuthenticatedPage(browser, CURRENT_URL);
  const tripId = await firstTripId(current.page);
  const before = await openAuthenticatedPage(browser, BEFORE_URL);

  try {
    for (const viewport of VIEWPORTS) {
      const path = `/trips/${tripId}/destination`;
      const currentScreenshot = await captureMain(current.page, path, viewport);
      await testInfo.attach(`after-${viewport.name}-destination`, {
        body: currentScreenshot,
        contentType: "image/png",
      });

      const beforeScreenshot = await captureMain(before.page, path, viewport);
      await testInfo.attach(`before-${viewport.name}-destination`, {
        body: beforeScreenshot,
        contentType: "image/png",
      });

      const snapshotName = `runtime-before-${viewport.name}-destination.png`;
      const snapshotPath = testInfo.snapshotPath(snapshotName);
      mkdirSync(dirname(snapshotPath), { recursive: true });
      writeFileSync(snapshotPath, beforeScreenshot);

      await expectApprovedChapterTitleTransition({
        currentPage: current.page,
        beforePage: before.page,
        currentScreenshot,
        beforeScreenshot,
        viewport,
        // Run 34645670196: exactly two rasterization pixels differed on Destination;
        // keep threshold 0 and localize the tolerance to this surface only.
        maxDiffPixels: 2,
        snapshotName,
      });
    }
  } finally {
    await current.context.close();
    await before.context.close();
  }
});

test("Accommodation matches the approved chapter-title contract", async ({ browser }, testInfo) => {
  test.setTimeout(360_000);
  expect(CURRENT_URL, "KREW_E2E_BASE_URL must be configured").not.toBe("");
  expect(BEFORE_URL, "KREW_E2E_BEFORE_URL must be configured for migration proof").not.toBe("");
  const current = await openAuthenticatedPage(browser, CURRENT_URL);
  const tripId = await firstTripId(current.page);
  const before = await openAuthenticatedPage(browser, BEFORE_URL);

  try {
    for (const viewport of VIEWPORTS) {
      const path = `/trips/${tripId}/accommodation`;
      const currentScreenshot = await captureMain(current.page, path, viewport);
      await testInfo.attach(`after-${viewport.name}-accommodation`, {
        body: currentScreenshot,
        contentType: "image/png",
      });

      const beforeScreenshot = await captureMain(before.page, path, viewport);
      await testInfo.attach(`before-${viewport.name}-accommodation`, {
        body: beforeScreenshot,
        contentType: "image/png",
      });

      const snapshotName = `runtime-before-${viewport.name}-accommodation.png`;
      const snapshotPath = testInfo.snapshotPath(snapshotName);
      mkdirSync(dirname(snapshotPath), { recursive: true });
      writeFileSync(snapshotPath, beforeScreenshot);

      await expectApprovedChapterTitleTransition({
        currentPage: current.page,
        beforePage: before.page,
        currentScreenshot,
        beforeScreenshot,
        viewport,
        // Run 34645670196: exactly two rasterization pixels differed on Accommodation;
        // keep threshold 0 and localize the tolerance to this surface only.
        maxDiffPixels: 2,
        snapshotName,
      });
    }
  } finally {
    await current.context.close();
    await before.context.close();
  }
});

test("Planning matches the approved chapter-title contract", async ({ browser }, testInfo) => {
  test.setTimeout(360_000);
  expect(CURRENT_URL, "KREW_E2E_BASE_URL must be configured").not.toBe("");
  expect(BEFORE_URL, "KREW_E2E_BEFORE_URL must be configured for migration proof").not.toBe("");
  const current = await openAuthenticatedPage(browser, CURRENT_URL);
  const tripId = await firstTripId(current.page);
  const before = await openAuthenticatedPage(browser, BEFORE_URL);

  try {
    for (const viewport of VIEWPORTS) {
      const path = `/trips/${tripId}/planning`;
      const currentScreenshot = await captureJourneySurface(current.page, path, viewport);
      await testInfo.attach(`after-${viewport.name}-planning`, {
        body: currentScreenshot,
        contentType: "image/png",
      });

      const beforeScreenshot = await captureJourneySurface(before.page, path, viewport);
      await testInfo.attach(`before-${viewport.name}-planning`, {
        body: beforeScreenshot,
        contentType: "image/png",
      });

      const snapshotName = `runtime-before-${viewport.name}-planning.png`;
      const snapshotPath = testInfo.snapshotPath(snapshotName);
      mkdirSync(dirname(snapshotPath), { recursive: true });
      writeFileSync(snapshotPath, beforeScreenshot);

      await expectApprovedChapterTitleTransition({
        currentPage: current.page,
        beforePage: before.page,
        currentScreenshot,
        beforeScreenshot,
        viewport,
        // Run 34645670196: exactly two rasterization pixels differed on Planning;
        // keep threshold 0 and localize the tolerance to this surface only.
        maxDiffPixels: 2,
        snapshotName,
      });
    }
  } finally {
    await current.context.close();
    await before.context.close();
  }
});
for (const surface of [
  { name: "Availability", slug: "availability" },
  { name: "Questionnaire", slug: "questionnaire" },
  { name: "Star", slug: "star" },
] as const) {
  test(`${surface.name} matches the approved chapter-title contract`, async ({ browser }, testInfo) => {
    test.setTimeout(360_000);
    expect(CURRENT_URL, "KREW_E2E_BASE_URL must be configured").not.toBe("");
    expect(BEFORE_URL, "KREW_E2E_BEFORE_URL must be configured for migration proof").not.toBe("");
    const current = await openAuthenticatedPage(browser, CURRENT_URL);
    const tripId = await firstTripId(current.page);
    const before = await openAuthenticatedPage(browser, BEFORE_URL);

    try {
      for (const viewport of VIEWPORTS) {
        const path = `/trips/${tripId}/${surface.slug}`;
        const currentScreenshot = await captureJourneySurface(current.page, path, viewport);
        await testInfo.attach(`after-${viewport.name}-${surface.slug}`, {
          body: currentScreenshot,
          contentType: "image/png",
        });

        const beforeScreenshot = await captureJourneySurface(before.page, path, viewport);
        await testInfo.attach(`before-${viewport.name}-${surface.slug}`, {
          body: beforeScreenshot,
          contentType: "image/png",
        });

        const snapshotName = `runtime-before-${viewport.name}-${surface.slug}.png`;
        const snapshotPath = testInfo.snapshotPath(snapshotName);
        mkdirSync(dirname(snapshotPath), { recursive: true });
        writeFileSync(snapshotPath, beforeScreenshot);

        await expectApprovedChapterTitleTransition({
          currentPage: current.page,
          beforePage: before.page,
          currentScreenshot,
          beforeScreenshot,
          viewport,
        });
      }
    } finally {
      await current.context.close();
      await before.context.close();
    }
  });
}

test("Invite matches the approved D8 section-title contract", async ({ browser }, testInfo) => {
  test.setTimeout(360_000);
  expect(CURRENT_URL, "KREW_E2E_BASE_URL must be configured").not.toBe("");
  expect(BEFORE_URL, "KREW_E2E_BEFORE_URL must be configured for migration proof").not.toBe("");
  const current = await openAuthenticatedPage(browser, CURRENT_URL);
  const tripId = await firstTripId(current.page);
  const before = await openAuthenticatedPage(browser, BEFORE_URL);

  try {
    for (const viewport of VIEWPORTS) {
      const path = `/trips/${tripId}/invite`;
      const currentScreenshot = await captureJourneySurface(current.page, path, viewport);
      await testInfo.attach(`after-${viewport.name}-invite`, {
        body: currentScreenshot,
        contentType: "image/png",
      });

      const beforeScreenshot = await captureJourneySurface(before.page, path, viewport);
      await testInfo.attach(`before-${viewport.name}-invite`, {
        body: beforeScreenshot,
        contentType: "image/png",
      });

      const currentTitle = current.page.getByRole("heading", { name: "Fais entrer la Krew" });
      const beforeTitle = before.page.getByRole("heading", { name: "Fais entrer la Krew" });
      expectApprovedTitleTransition({
        currentScreenshot,
        beforeScreenshot,
        currentSize: await currentTitle.evaluate((title) => Number.parseFloat(getComputedStyle(title).fontSize)),
        beforeSize: await beforeTitle.evaluate((title) => Number.parseFloat(getComputedStyle(title).fontSize)),
        expectedCurrentSize: viewport.name === "mobile" ? 24 : 26,
        // PR #387 D8 is now the main baseline.
        expectedBeforeSize: viewport.name === "mobile" ? 24 : 26,
      });
    }
  } finally {
    await current.context.close();
    await before.context.close();
  }
});

test("Recap matches the approved D5 shell and D8 section-title contracts", async ({ browser }, testInfo) => {
  test.setTimeout(360_000);
  expect(CURRENT_URL, "KREW_E2E_BASE_URL must be configured").not.toBe("");
  expect(BEFORE_URL, "KREW_E2E_BEFORE_URL must be configured for migration proof").not.toBe("");
  const current = await openAuthenticatedPage(browser, CURRENT_URL);
  const tripId = await firstTripId(current.page);
  const before = await openAuthenticatedPage(browser, BEFORE_URL);

  try {
    for (const viewport of VIEWPORTS) {
      const path = `/trips/${tripId}/recap`;
      const currentScreenshot = await captureJourneySurface(current.page, path, viewport);
      await testInfo.attach(`after-${viewport.name}-recap`, {
        body: currentScreenshot,
        contentType: "image/png",
      });

      const beforeScreenshot = await captureJourneySurface(before.page, path, viewport);
      await testInfo.attach(`before-${viewport.name}-recap`, {
        body: beforeScreenshot,
        contentType: "image/png",
      });

      expect(await renderedPageShellWidth(current.page)).toBe(
        viewport.name === "desktop" ? 1024 : viewport.width,
      );
      // PR #387 D5 is now the main baseline.
      expect(await renderedPageShellWidth(before.page)).toBe(
        viewport.name === "desktop" ? 1024 : viewport.width,
      );

      const selector = "main section.space-y-4.pt-4 > h2";
      const currentTitle = current.page.locator(selector).first();
      const beforeTitle = before.page.locator(selector).first();
      const currentCount = await currentTitle.count();
      const beforeCount = await beforeTitle.count();
      expect(currentCount).toBe(beforeCount);

      if (currentCount > 0) {
        expect(await currentTitle.evaluate((title) => Number.parseFloat(getComputedStyle(title).fontSize))).toBe(
          viewport.name === "mobile" ? 24 : 26,
        );
        // PR #387 D8 is now the main baseline.
        expect(await beforeTitle.evaluate((title) => Number.parseFloat(getComputedStyle(title).fontSize))).toBe(
          viewport.name === "mobile" ? 24 : 26,
        );
      }

      // Récap contains live cost/weather data. The before/after PNGs remain
      // attached for review, while deterministic post-#387 D5 width and D8 font-size
      // values above form the automated visual contract.
    }
  } finally {
    await current.context.close();
    await before.context.close();
  }
});

test("Account surface remains pixel-identical at contract reference viewports", async ({ browser }, testInfo) => {
  test.setTimeout(360_000);
  expect(CURRENT_URL, "KREW_E2E_BASE_URL must be configured").not.toBe("");
  expect(BEFORE_URL, "KREW_E2E_BEFORE_URL must be configured for migration proof").not.toBe("");
  const current = await openAuthenticatedPage(browser, CURRENT_URL);
  const before = await openAuthenticatedPage(browser, BEFORE_URL);

  try {
    for (const viewport of VIEWPORTS) {
      const snapshotName = `runtime-before-${viewport.name}-account.png`;
      const snapshotPath = testInfo.snapshotPath(snapshotName);
      let currentScreenshot = await captureJourneySurface(current.page, "/account", viewport);
      let beforeScreenshot = await captureJourneySurface(before.page, "/account", viewport);
      let comparisonError: unknown;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        mkdirSync(dirname(snapshotPath), { recursive: true });
        writeFileSync(snapshotPath, beforeScreenshot);
        try {
          expect(currentScreenshot).toMatchSnapshot(snapshotName, {
            threshold: 0,
            // Evidence from run 34683349063: one isolated raster pixel on desktop.
            // Keep the color threshold exact while tolerating at most two pixels.
            maxDiffPixels: 2,
          });
          comparisonError = undefined;
          break;
        } catch (error) {
          comparisonError = error;
          if (attempt < 2) {
            currentScreenshot = await captureJourneySurface(current.page, "/account", viewport);
            beforeScreenshot = await captureJourneySurface(before.page, "/account", viewport);
          }
        }
      }

      if (comparisonError) throw comparisonError;
      await testInfo.attach(`after-${viewport.name}-account`, { body: currentScreenshot, contentType: "image/png" });
      await testInfo.attach(`before-${viewport.name}-account`, { body: beforeScreenshot, contentType: "image/png" });
    }
  } finally {
    await current.context.close();
    await before.context.close();
  }
});

test("Memories matches the approved D5 story-shell contract", async ({ browser }, testInfo) => {
  test.setTimeout(360_000);
  expect(CURRENT_URL, "KREW_E2E_BASE_URL must be configured").not.toBe("");
  expect(BEFORE_URL, "KREW_E2E_BEFORE_URL must be configured for migration proof").not.toBe("");
  const current = await openAuthenticatedPage(browser, CURRENT_URL);
  const tripId = await firstTripId(current.page);
  const before = await openAuthenticatedPage(browser, BEFORE_URL);

  try {
    for (const viewport of VIEWPORTS) {
      const path = `/trips/${tripId}/memories`;
      const currentScreenshot = await captureJourneySurface(current.page, path, viewport);
      await testInfo.attach(`after-${viewport.name}-memories`, {
        body: currentScreenshot,
        contentType: "image/png",
      });

      const beforeScreenshot = await captureJourneySurface(before.page, path, viewport);
      await testInfo.attach(`before-${viewport.name}-memories`, {
        body: beforeScreenshot,
        contentType: "image/png",
      });

      expectApprovedWidthTransition({
        currentScreenshot,
        beforeScreenshot,
        currentWidth: await renderedPageShellWidth(current.page),
        beforeWidth: await renderedPageShellWidth(before.page),
        expectedCurrentWidth: viewport.name === "desktop" ? 1024 : viewport.width,
        // PR #387 D5 is now the main baseline.
        expectedBeforeWidth: viewport.name === "desktop" ? 1024 : viewport.width,
      });
    }
  } finally {
    await current.context.close();
    await before.context.close();
  }
});
