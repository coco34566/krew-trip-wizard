import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { handleNormalUserUi, signIn } from "./helpers";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "desktop", width: 1440, height: 1000 },
] as const;

async function settle(page: Page) {
  await handleNormalUserUi(page);
  await expect(page.locator("body")).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(200);
}

async function capture(page: Page, testInfo: TestInfo, viewport: string, name: string, path: string) {
  await page.goto(path);
  await settle(page);
  const geometry = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth, `${viewport}/${name}: no horizontal overflow`).toBeLessThanOrEqual(geometry.width + 1);
  const screenshotPath = testInfo.outputPath(`${viewport}-${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
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
  return null;
}

test("secondary and public customer surfaces visual audit", async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  test.skip(testInfo.project.name !== "mobile-safari", "Secondary audit creates all target viewports itself.");

  const publicPages = [
    ["auth", "/auth"],
    ["faq", "/faq"],
    ["tarifs", "/tarifs"],
    ["a-propos", "/a-propos"],
    ["mentions-legales", "/mentions-legales"],
    ["cgu", "/cgu"],
    ["confidentialite", "/confidentialite"],
  ] as const;

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const [name, path] of publicPages) await capture(page, testInfo, viewport.name, name, path);
  }

  await page.setViewportSize({ width: VIEWPORTS[0].width, height: VIEWPORTS[0].height });
  await signIn(page);
  const tripId = await firstTripId(page);

  const authenticatedPages: Array<readonly [string, string]> = [
    ["account", "/account"],
    ["trip-create", "/trips/new"],
  ];
  if (tripId) {
    authenticatedPages.push(["trip-recap", `/trips/${tripId}/recap`]);
    authenticatedPages.push(["memories", `/trips/${tripId}/memories`]);
  }

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const [name, path] of authenticatedPages) await capture(page, testInfo, viewport.name, name, path);
  }
});
