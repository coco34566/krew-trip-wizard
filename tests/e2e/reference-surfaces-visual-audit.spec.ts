import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { handleNormalUserUi, signIn } from "./helpers";

const VIEWPORTS = [
  { name: "narrow-mobile", width: 320, height: 568, screenshot: false },
  { name: "mobile", width: 390, height: 844, screenshot: true },
  { name: "mobile-landscape", width: 844, height: 390, screenshot: false },
  { name: "tablet", width: 834, height: 1112, screenshot: true },
  { name: "tablet-landscape", width: 1112, height: 834, screenshot: false },
  { name: "desktop", width: 1440, height: 1000, screenshot: true },
  { name: "wide-desktop", width: 1728, height: 1100, screenshot: false },
] as const;

const MAX_FULL_PAGE_HEIGHT = 30_000;
const LONG_PAGE_CAPTURE_HEIGHT = 12_000;

type ReferenceMetric = {
  viewport: string;
  page: string;
  width: number;
  scrollWidth: number;
  scrollHeight: number;
};

async function settle(page: Page) {
  await handleNormalUserUi(page);
  await expect(page.locator("main")).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForFunction(() => !document.querySelector("main .animate-pulse"), undefined, { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(150);
}

async function capture(
  page: Page,
  testInfo: TestInfo,
  metrics: ReferenceMetric[],
  viewport: (typeof VIEWPORTS)[number],
  name: string,
  path: string,
) {
  await page.goto(path);
  await settle(page);
  const geometry = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }));
  metrics.push({ viewport: viewport.name, page: name, ...geometry });
  expect(geometry.scrollWidth, `${viewport.name}/${name}: no horizontal overflow`).toBeLessThanOrEqual(geometry.width + 1);

  if (!viewport.screenshot) return;
  const screenshotPath = testInfo.outputPath(`${viewport.name}-${name}.png`);
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
  await testInfo.attach(`${viewport.name}-${name}`, { path: screenshotPath, contentType: "image/png" });
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
  test.setTimeout(480_000);
  test.skip(testInfo.project.name !== "mobile-safari", "Reference audit creates all target viewports itself.");
  const metrics: ReferenceMetric[] = [];

  const publicPages = [
    ["landing", "/"],
    ["faq", "/faq"],
    ["tarifs", "/tarifs"],
    ["a-propos", "/a-propos"],
    ["cgu", "/cgu"],
    ["confidentialite", "/confidentialite"],
    ["mentions-legales", "/mentions-legales"],
    ["auth", "/auth"],
  ] as const;

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const [name, path] of publicPages) await capture(page, testInfo, metrics, viewport, name, path);
  }

  await page.setViewportSize({ width: VIEWPORTS[0].width, height: VIEWPORTS[0].height });
  await signIn(page);
  const tripId = await firstTripId(page);

  const authenticatedPages = [
    ["mes-voyages", "/dashboard"],
    ["nouveau-voyage", "/trips/new"],
    ["trip-dashboard", `/trips/${tripId}`],
    ["account", "/account"],
    ["recap", `/trips/${tripId}/recap`],
    ["memories", `/trips/${tripId}/memories`],
  ] as const;

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const [name, path] of authenticatedPages) await capture(page, testInfo, metrics, viewport, name, path);
  }

  await testInfo.attach("reference-surface-metrics", {
    body: Buffer.from(JSON.stringify(metrics, null, 2)),
    contentType: "application/json",
  });
});
