import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { handleNormalUserUi, signIn } from "./helpers";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "desktop", width: 1440, height: 1000 },
] as const;

const MAX_FULL_PAGE_HEIGHT = 30_000;
const LONG_PAGE_CAPTURE_HEIGHT = 12_000;

async function settle(page: Page) {
  await handleNormalUserUi(page);
  await expect(page.locator("main")).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForFunction(() => !document.querySelector("main .animate-pulse"), undefined, { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(200);
}

async function capture(page: Page, testInfo: TestInfo, viewport: string, name: string, path: string) {
  await page.goto(path);
  await settle(page);
  const geometry = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }));
  expect(geometry.scrollWidth, `${viewport}/${name}: no horizontal overflow`).toBeLessThanOrEqual(geometry.width + 1);

  const screenshotPath = testInfo.outputPath(`${viewport}-${name}.png`);
  if (geometry.scrollHeight <= MAX_FULL_PAGE_HEIGHT) {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } else {
    await page.screenshot({
      path: screenshotPath,
      clip: {
        x: 0,
        y: 0,
        width: geometry.width,
        height: Math.min(geometry.scrollHeight, LONG_PAGE_CAPTURE_HEIGHT),
      },
    });
  }
  await testInfo.attach(`${viewport}-${name}`, { path: screenshotPath, contentType: "image/png" });
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
  throw new Error("Reference visual audit needs at least one trip on the QA account");
}

test("reference surfaces visual audit", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  test.skip(testInfo.project.name !== "mobile-safari", "Reference audit creates all target viewports itself.");

  // Public marketing surface: capture before authentication.
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await capture(page, testInfo, viewport.name, "landing", "/");
  }

  await page.setViewportSize({ width: VIEWPORTS[0].width, height: VIEWPORTS[0].height });
  await signIn(page);
  const tripId = await firstTripId(page);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await capture(page, testInfo, viewport.name, "mes-voyages", "/dashboard");
    await capture(page, testInfo, viewport.name, "trip-dashboard", `/trips/${tripId}`);
  }
});
