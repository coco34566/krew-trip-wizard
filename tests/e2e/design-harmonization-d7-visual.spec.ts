import { expect, test, type Browser, type Page } from "@playwright/test";

import { handleNormalUserUi, signIn } from "./helpers";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "desktop", width: 1440, height: 1000 },
] as const;

const CURRENT_URL = (process.env.KREW_E2E_BASE_URL ?? "").replace(/\/$/, "");
const BEFORE_URL = (process.env.KREW_E2E_BEFORE_URL ?? "").replace(/\/$/, "");

async function openAuthenticatedPage(browser: Browser, baseURL: string) {
  const context = await browser.newContext({ baseURL, serviceWorkers: "block" });
  await context.addInitScript(() => {
    localStorage.setItem(
      "krew-cookie-consent",
      JSON.stringify({
        essential: true,
        analytics: false,
        personalization: false,
        advertising: false,
        retargeting: false,
        social: false,
        affiliate: false,
        date: "1970-01-01T00:00:00.000Z",
        version: 1,
      }),
    );
  });
  const page = await context.newPage();
  await signIn(page);
  return { context, page };
}

async function firstTripId(page: Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto("/dashboard");
    await handleNormalUserUi(page);
    await expect(page.locator("main")).toBeVisible();
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    await page
      .waitForFunction(() => !document.querySelector("main .animate-pulse"), undefined, {
        timeout: 15_000,
      })
      .catch(() => undefined);
    const hrefs = await page
      .locator('a[href*="/trips/"]')
      .evaluateAll((links) =>
        links.map((link) => (link as HTMLAnchorElement).getAttribute("href") ?? ""),
      );
    for (const href of hrefs) {
      const match = href.match(/\/trips\/([0-9a-f-]{36})(?:[/?#]|$)/i);
      if (match?.[1]) return match[1];
    }
  }
  throw new Error("D7 visual proof needs at least one trip on the QA account");
}

async function capturePendingState(
  page: Page,
  path: string,
  marker: string,
  viewport: (typeof VIEWPORTS)[number],
  visualMarker?: string,
) {
  let releaseRequests = () => undefined;
  const requestBarrier = new Promise<void>((resolve) => {
    releaseRequests = resolve;
  });
  const serverFnPattern = "**/_serverFn/**";
  await page.route(serverFnPattern, async (route) => {
    await requestBarrier;
    await route.continue();
  });

  try {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const shell = page.locator(marker).first();
    await expect(shell).toBeVisible({ timeout: 20_000 });
    await page.evaluate(() => document.fonts.ready).catch(() => undefined);
    // Preview-only Vercel chrome is outside the KREW visual contract. The failed
    // PR #389 artifact showed identical D7 geometry/content with only this
    // floating control present on one preview. Keep the KREW pixels strict after hiding it.
    await page.addStyleTag({
      content: `
        vercel-live-feedback,
        vercel-toolbar,
        #vercel-toolbar,
        iframe[src*="vercel.live"] {
          display: none !important;
        }
      `,
    });
    // D7 measures geometry on the page shell, but the pixel contract concerns the
    // pending visual itself. For Recap, run 34681047847 proved the two thinking cards
    // are pixel-identical while the outer shell differs only by two trailing blank rows
    // from subpixel element-height rounding. Capture the semantic pending visual when
    // supplied, keeping the comparison at exact pixel equality.
    const visual = visualMarker ? page.locator(visualMarker).first() : shell;
    await expect(visual).toBeVisible({ timeout: 20_000 });
    const screenshot = await visual.screenshot({ animations: "disabled" });
    const geometry = await shell.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        width: Math.round(element.getBoundingClientRect().width),
        paddingLeft: Number.parseFloat(style.paddingLeft),
        paddingTop: Number.parseFloat(style.paddingTop),
        size: element.getAttribute("data-krew-page-size"),
        gutter: element.getAttribute("data-krew-page-gutter"),
      };
    });
    return { screenshot, geometry };
  } finally {
    releaseRequests();
    // Wait for every blocked handler to finish before removing it; otherwise
    // Playwright may auto-continue a request while the handler does the same.
    await page.unrouteAll({ behavior: "wait" });
  }
}

// Post-merge baseline: PR #387 is already in main, so before/after must agree unless a later PR changes D7.
test("D7 records the approved Invite and Recap pending-state geometry", async ({
  browser,
}, testInfo) => {
  test.setTimeout(360_000);
  expect(CURRENT_URL, "KREW_E2E_BASE_URL must be configured").not.toBe("");
  expect(BEFORE_URL, "KREW_E2E_BEFORE_URL must be configured").not.toBe("");
  const current = await openAuthenticatedPage(browser, CURRENT_URL);
  const tripId = await firstTripId(current.page);
  const before = await openAuthenticatedPage(browser, BEFORE_URL);

  try {
    for (const viewport of VIEWPORTS) {
      const currentInvite = await capturePendingState(
        current.page,
        `/trips/${tripId}/invite`,
        "[data-krew-journey-loading]",
        viewport,
        '[role="status"]',
      );
      const beforeInvite = await capturePendingState(
        before.page,
        `/trips/${tripId}/invite`,
        "[data-krew-journey-loading]",
        viewport,
        '[role="status"]',
      );
      await testInfo.attach(`after-d7-${viewport.name}-invite-loading`, {
        body: currentInvite.screenshot,
        contentType: "image/png",
      });
      await testInfo.attach(`before-d7-${viewport.name}-invite-loading`, {
        body: beforeInvite.screenshot,
        contentType: "image/png",
      });

      expect(currentInvite.geometry.size).toBe("form");
      expect(currentInvite.geometry.gutter).toBe("narrow");
      expect(currentInvite.geometry.paddingLeft).toBe(viewport.name === "mobile" ? 16 : 24);
      // Baseline rebased after PR #387: main already contains the approved D7 Invite geometry.
      expect(beforeInvite.geometry.paddingLeft).toBe(viewport.name === "mobile" ? 16 : 24);
      expect(currentInvite.geometry.width).toBe(viewport.name === "mobile" ? viewport.width : 820);
      expect(beforeInvite.geometry.width).toBe(viewport.name === "mobile" ? viewport.width : 820);
      expect(currentInvite.screenshot.equals(beforeInvite.screenshot)).toBe(true);

      const currentRecap = await capturePendingState(
        current.page,
        `/trips/${tripId}/recap`,
        'main[data-krew-story-page="recap"]',
        viewport,
        '[role="status"]',
      );
      const beforeRecap = await capturePendingState(
        before.page,
        `/trips/${tripId}/recap`,
        'main[data-krew-story-page="recap"]',
        viewport,
        '[role="status"]',
      );
      await testInfo.attach(`after-d7-${viewport.name}-recap-loading`, {
        body: currentRecap.screenshot,
        contentType: "image/png",
      });
      await testInfo.attach(`before-d7-${viewport.name}-recap-loading`, {
        body: beforeRecap.screenshot,
        contentType: "image/png",
      });

      expect(currentRecap.geometry.paddingTop).toBe(viewport.name === "mobile" ? 32 : 48);
      // Baseline rebased after PR #387: main already contains the approved D7 Recap spacing.
      expect(beforeRecap.geometry.paddingTop).toBe(viewport.name === "mobile" ? 32 : 48);
      expect(currentRecap.screenshot.equals(beforeRecap.screenshot)).toBe(true);
    }
  } finally {
    await current.context.close();
    await before.context.close();
  }
});
