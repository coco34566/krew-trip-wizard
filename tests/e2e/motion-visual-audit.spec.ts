import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { handleNormalUserUi, signIn } from "./helpers";

const HERO_VIEWPORTS = [
  { name: "narrow-mobile", width: 320, height: 700 },
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 1000 },
] as const;

const HERO_TIMES = [0, 120, 260, 480, 820, 1200] as const;

async function settleAppChrome(page: Page) {
  await handleNormalUserUi(page);
  await expect(page.locator("main")).toBeVisible({ timeout: 20_000 });
}

async function captureHeroTimeline(page: Page, testInfo: TestInfo, viewport: (typeof HERO_VIEWPORTS)[number], pass: string) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await settleAppChrome(page);

  let previous = 0;
  for (const time of HERO_TIMES) {
    if (time > previous) await page.waitForTimeout(time - previous);
    previous = time;
    const path = testInfo.outputPath(`${viewport.name}-${pass}-hero-${time}ms.png`);
    await page.screenshot({ path });
    await testInfo.attach(`${viewport.name}-${pass}-hero-${time}ms`, { path, contentType: "image/png" });
  }

  const finalGeometry = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    photo: getComputedStyle(document.querySelector(".krew-hero-photo-settle")!).transform,
    cta: getComputedStyle(document.querySelector(".krew-hero-cta")!).transform,
  }));
  expect(finalGeometry.scrollWidth).toBeLessThanOrEqual(finalGeometry.width + 1);
  return finalGeometry;
}

async function dashboardReady(page: Page) {
  await page.goto("/dashboard");
  await settleAppChrome(page);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForFunction(() => !document.querySelector("main .animate-pulse"), undefined, { timeout: 20_000 }).catch(() => undefined);
  await expect(page.locator(".krew-trip-reveal").first()).toBeVisible({ timeout: 20_000 });
}

async function scrollAndCapture(page: Page, testInfo: TestInfo, viewport: string, mode: "slow" | "normal" | "fast") {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(80);

  if (mode === "slow") {
    for (let i = 0; i < 7; i += 1) {
      await page.mouse.wheel(0, 220);
      await page.waitForTimeout(170);
    }
  } else if (mode === "normal") {
    for (let i = 0; i < 5; i += 1) {
      await page.mouse.wheel(0, 420);
      await page.waitForTimeout(85);
    }
  } else {
    await page.mouse.wheel(0, 2600);
    await page.waitForTimeout(90);
  }

  const immediate = await page.evaluate(() => ({
    y: window.scrollY,
    visibleUnsettled: Array.from(document.querySelectorAll<HTMLElement>(".krew-trip-reveal[data-revealed='false']")).filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < innerHeight;
    }).length,
  }));

  await page.waitForTimeout(480);
  const settled = await page.evaluate(() => ({
    y: window.scrollY,
    visibleUnsettled: Array.from(document.querySelectorAll<HTMLElement>(".krew-trip-reveal[data-revealed='false']")).filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < innerHeight;
    }).length,
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  const path = testInfo.outputPath(`${viewport}-mes-voyages-${mode}.png`);
  await page.screenshot({ path });
  await testInfo.attach(`${viewport}-mes-voyages-${mode}`, { path, contentType: "image/png" });
  expect(settled.visibleUnsettled, `${viewport}/${mode}: visible cards settle promptly`).toBe(0);
  expect(settled.scrollWidth).toBeLessThanOrEqual(settled.width + 1);
  return { mode, immediate, settled };
}

test("@motion landing hero choreography", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  test.skip(testInfo.project.name !== "mobile-safari", "Motion audit drives its own target viewports.");
  const metrics = [];

  for (const viewport of HERO_VIEWPORTS) {
    metrics.push({ viewport: viewport.name, pass: "cold", ...(await captureHeroTimeline(page, testInfo, viewport, "cold")) });
    metrics.push({ viewport: viewport.name, pass: "reload", ...(await captureHeroTimeline(page, testInfo, viewport, "reload")) });
  }

  await testInfo.attach("hero-motion-metrics", {
    body: Buffer.from(JSON.stringify(metrics, null, 2)),
    contentType: "application/json",
  });
});

test("@motion mes voyages reveal at slow normal and fast scroll", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  test.skip(testInfo.project.name !== "mobile-safari", "Motion audit drives its own target viewports.");
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);

  const results = [];
  for (const viewport of [
    { name: "mobile", width: 390, height: 844 },
    { name: "desktop", width: 1440, height: 1000 },
  ] as const) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const mode of ["slow", "normal", "fast"] as const) {
      await dashboardReady(page);
      results.push({ viewport: viewport.name, ...(await scrollAndCapture(page, testInfo, viewport.name, mode)) });
    }
  }

  await testInfo.attach("mes-voyages-motion-metrics", {
    body: Buffer.from(JSON.stringify(results, null, 2)),
    contentType: "application/json",
  });
});
