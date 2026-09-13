import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { handleNormalUserUi, signIn } from "./helpers";

const CURRENT_URL = process.env.KREW_E2E_BASE_URL || "";
const BEFORE_URL = process.env.KREW_E2E_BEFORE_URL || "";
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "desktop", width: 1440, height: 1000 },
] as const;

async function openAuthenticatedPage(browser: Browser, baseURL: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await signIn(page);
  return { context, page };
}

async function settle(page: Page) {
  await handleNormalUserUi(page);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForFunction(() => !document.querySelector("main .animate-pulse"), undefined, { timeout: 20_000 }).catch(() => undefined);
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
  throw new Error("D8 visual proof needs at least one trip on the QA account");
}

async function capture(page: Page, path: string, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto(path);
  await settle(page);
  return page.screenshot({ animations: "disabled", fullPage: true, timeout: 45_000 });
}

test("D8 establishes the approved page-section title scale", async ({ browser }, testInfo) => {
  test.setTimeout(360_000);
  expect(CURRENT_URL, "KREW_E2E_BASE_URL must be configured").not.toBe("");
  expect(BEFORE_URL, "KREW_E2E_BEFORE_URL must be configured").not.toBe("");
  const current = await openAuthenticatedPage(browser, CURRENT_URL);
  const tripId = await firstTripId(current.page);
  const before = await openAuthenticatedPage(browser, BEFORE_URL);
  // Availability is now the first chapter of /questionnaire rather than a separate customer surface.
  // Keep one D8 contract for the unified questionnaire while preserving the approved 24/26px scale.
  const surfaces = [
    {
      name: "questionnaire",
      path: `/trips/${tripId}/questionnaire`,
      currentSelector: "[data-krew-availability-page] section h2",
      beforeSelector: "[data-krew-preferences-page] > div > section h2",
      mobileBefore: 24,
      desktopBefore: 26,
    },
    {
      name: "star",
      path: `/trips/${tripId}/star`,
      currentSelector: "[data-krew-preferences-page] > div > section h2",
      beforeSelector: "[data-krew-preferences-page] > div > section h2",
      mobileBefore: 24,
      desktopBefore: 26,
    },
    {
      name: "planning",
      path: `/trips/${tripId}/planning`,
      currentSelector: "main article h2",
      beforeSelector: "main article h2",
      mobileBefore: 24,
      desktopBefore: 26,
    },
    {
      name: "destination",
      path: `/trips/${tripId}/destination`,
      currentSelector: "main h2",
      beforeSelector: "main h2",
      mobileBefore: 24,
      desktopBefore: 26,
    },
    {
      name: "invite",
      path: `/trips/${tripId}/invite`,
      currentSelector: "main h2",
      beforeSelector: "main h2",
      mobileBefore: 24,
      desktopBefore: 26,
    },
    {
      name: "recap",
      path: `/trips/${tripId}/recap`,
      currentSelector: "main section.space-y-4.pt-4 > h2",
      beforeSelector: "main section.space-y-4.pt-4 > h2",
      mobileBefore: 24,
      desktopBefore: 26,
    },
  ] as const;

  try {
    for (const viewport of VIEWPORTS) {
      for (const surface of surfaces) {
        const currentScreenshot = await capture(
          current.page,
          surface.path,
          viewport.width,
          viewport.height,
        );
        const beforeScreenshot = await capture(
          before.page,
          surface.path,
          viewport.width,
          viewport.height,
        );
        await testInfo.attach(`after-d8-${viewport.name}-${surface.name}`, {
          body: currentScreenshot,
          contentType: "image/png",
        });
        await testInfo.attach(`before-d8-${viewport.name}-${surface.name}`, {
          body: beforeScreenshot,
          contentType: "image/png",
        });

        const currentTitle = current.page.locator(surface.currentSelector).first();
        const beforeTitle = before.page.locator(surface.beforeSelector).first();
        const currentCount = await currentTitle.count();
        const beforeCount = await beforeTitle.count();
        expect(currentCount).toBe(beforeCount);
        if (currentCount === 0) continue;

        const fontSize = async (title: typeof currentTitle) =>
          title.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
        expect(await fontSize(currentTitle)).toBe(viewport.name === "mobile" ? 24 : 26);
        expect(await fontSize(beforeTitle)).toBe(
          viewport.name === "mobile" ? surface.mobileBefore : surface.desktopBefore,
        );
        const expectedCurrentSize = viewport.name === "mobile" ? 24 : 26;
        const expectedBeforeSize =
          viewport.name === "mobile" ? surface.mobileBefore : surface.desktopBefore;
        if (expectedCurrentSize !== expectedBeforeSize) {
          expect(currentScreenshot.equals(beforeScreenshot)).toBe(false);
        }
      }
    }
  } finally {
    await current.context.close();
    await before.context.close();
  }
});
