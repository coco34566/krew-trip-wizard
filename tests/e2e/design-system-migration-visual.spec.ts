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

test("Tasks shell remains pixel-identical at contract reference viewports", async ({ browser }, testInfo) => {
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

test("Transport shell remains pixel-identical at contract reference viewports", async ({ browser }, testInfo) => {
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

test("Destination shell remains pixel-identical at contract reference viewports", async ({ browser }, testInfo) => {
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

test("Accommodation shell remains pixel-identical at contract reference viewports", async ({ browser }, testInfo) => {
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

test("Planning surface remains pixel-identical at contract reference viewports", async ({ browser }, testInfo) => {
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
for (const surface of [
  { name: "Availability", slug: "availability" },
  { name: "Questionnaire", slug: "questionnaire" },
  { name: "Star", slug: "star" },
] as const) {
  test(`${surface.name} shell remains pixel-identical at contract reference viewports`, async ({ browser }, testInfo) => {
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
}

test("Invite surface remains pixel-identical at contract reference viewports", async ({ browser }, testInfo) => {
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

      const snapshotName = `runtime-before-${viewport.name}-invite.png`;
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

test("Recap surface remains pixel-identical at contract reference viewports", async ({ browser }, testInfo) => {
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

      const snapshotName = `runtime-before-${viewport.name}-recap.png`;
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
            maxDiffPixels: 0,
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

test("Memories surface remains pixel-identical at contract reference viewports", async ({ browser }, testInfo) => {
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

      const snapshotName = `runtime-before-${viewport.name}-memories.png`;
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
