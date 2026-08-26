import { expect, test, type Browser, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { handleNormalUserUi, signIn } from "./helpers";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "desktop", width: 1440, height: 1000 },
] as const;

type VisualMetric = {
  viewport: string;
  page: string;
  width: number;
  scrollWidth: number;
  undersizedControls: Array<{ tag: string; text: string; width: number; height: number }>;
};

async function dashboardTripIds(page: Page) {
  await page.goto("/dashboard");
  await handleNormalUserUi(page);
  await expect(page.locator("main")).toBeVisible();

  // The dashboard query may still be showing skeletons after the shell is visible.
  // Wait for either a trip link or a genuine loaded empty state instead of reading the DOM too early.
  await page.waitForFunction(() => {
    const tripLinks = document.querySelectorAll('a[href*="/trips/"]');
    const text = document.querySelector("main")?.textContent || "";
    const hasEmptyState = /aucun voyage|pas encore de voyage|crée ton premier voyage/i.test(text);
    const hasSkeleton = Boolean(document.querySelector(".animate-pulse"));
    return tripLinks.length > 0 || (hasEmptyState && !hasSkeleton);
  }, undefined, { timeout: 15_000 }).catch(() => undefined);

  const hrefs = await page.locator('a[href*="/trips/"]').evaluateAll((links) =>
    links.map((link) => (link as HTMLAnchorElement).getAttribute("href") || ""),
  );
  const ids: string[] = [];
  for (const href of hrefs) {
    const match = href.match(/\/trips\/([0-9a-f-]{36})(?:[/?#]|$)/i);
    if (match?.[1] && !ids.includes(match[1])) ids.push(match[1]);
  }
  return ids.slice(0, 15);
}

async function findPreparedTrip(page: Page) {
  const ids = await dashboardTripIds(page);
  expect(ids.length, "Visual audit needs at least one loaded QA trip").toBeGreaterThan(0);

  for (const id of ids) {
    await page.goto(`/trips/${id}?view=voyage&section=accommodation`);
    await handleNormalUserUi(page);
    await page.waitForTimeout(700);
    if (await page.locator("#hub-logistics").isVisible().catch(() => false)) return id;
  }
  return ids[0]!;
}

async function capture(
  page: Page,
  testInfo: TestInfo,
  metrics: VisualMetric[],
  viewportName: string,
  name: string,
  path: string,
) {
  await page.goto(path);
  await handleNormalUserUi(page);
  await expect(page.locator("main")).toBeVisible();
  await page.waitForTimeout(650);

  const geometry = await page.evaluate(() => {
    const root = document.documentElement;
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      const box = (element as HTMLElement).getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
    };
    const controls = Array.from(document.querySelectorAll("button, select, a[role='button']"))
      .filter(visible)
      .map((element) => {
        const box = (element as HTMLElement).getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          text: (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
          width: Math.round(box.width),
          height: Math.round(box.height),
        };
      })
      .filter((control) => control.height < 40 || control.width < 40)
      .slice(0, 40);
    return { width: root.clientWidth, scrollWidth: root.scrollWidth, undersizedControls: controls };
  });

  metrics.push({ viewport: viewportName, page: name, ...geometry });
  expect(
    geometry.scrollWidth,
    `${viewportName}/${name}: no horizontal overflow (${geometry.scrollWidth}px content for ${geometry.width}px viewport)`,
  ).toBeLessThanOrEqual(geometry.width + 1);

  const screenshotPath = testInfo.outputPath(`${viewportName}-${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach(`${viewportName}-${name}`, { path: screenshotPath, contentType: "image/png" });
}

async function captureJourney(
  page: Page,
  testInfo: TestInfo,
  metrics: VisualMetric[],
  viewportName: string,
  tripId: string,
) {
  const pages = [
    ["invite", `/trips/${tripId}/invite`],
    ["availability", `/trips/${tripId}/availability`],
    ["preferences", `/trips/${tripId}/questionnaire`],
    ["dates", `/trips/${tripId}?view=voyage&section=dates`],
    ["profile", `/trips/${tripId}?view=voyage&section=profile`],
    ["destination", `/trips/${tripId}?view=voyage&section=destination`],
    ["accommodation", `/trips/${tripId}?view=voyage&section=accommodation`],
    ["transport", `/trips/${tripId}?view=voyage&section=transport`],
    ["planning", `/trips/${tripId}?view=voyage&section=planning`],
    ["tasks", `/trips/${tripId}?view=voyage&section=tasks`],
    ["packing", `/trips/${tripId}?view=voyage&section=packing`],
  ] as const;

  for (const [name, path] of pages) await capture(page, testInfo, metrics, viewportName, name, path);

  // Star is conditional. Capture it only when the route renders normally for this trip/account.
  await page.goto(`/trips/${tripId}/star`);
  await handleNormalUserUi(page);
  await page.waitForTimeout(500);
  if (await page.locator("main h1").isVisible().catch(() => false)) {
    const screenshotPath = testInfo.outputPath(`${viewportName}-star.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach(`${viewportName}-star`, { path: screenshotPath, contentType: "image/png" });
  }
}

async function signedInContext(browser: Browser, width: number, height: number): Promise<BrowserContext> {
  const context = await browser.newContext({
    baseURL: process.env.KREW_E2E_BASE_URL,
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await signIn(page);
  await page.close();
  return context;
}

test("read-only visual audit of every customer-journey chapter", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-safari", "Visual audit runs once and creates all target viewports itself.");
  const metrics: VisualMetric[] = [];

  await page.setViewportSize({ width: VIEWPORTS[0].width, height: VIEWPORTS[0].height });
  await signIn(page);
  const tripId = await findPreparedTrip(page);

  await captureJourney(page, testInfo, metrics, "mobile", tripId);

  for (const viewport of VIEWPORTS.slice(1)) {
    const context = await signedInContext(browser, viewport.width, viewport.height);
    try {
      const auditPage = await context.newPage();
      await captureJourney(auditPage, testInfo, metrics, viewport.name, tripId);
      await auditPage.close();
    } finally {
      await context.close();
    }
  }

  await testInfo.attach("visual-audit-metrics", {
    body: Buffer.from(JSON.stringify(metrics, null, 2)),
    contentType: "application/json",
  });
  await testInfo.attach("visual-audit-trip", {
    body: Buffer.from(JSON.stringify({ tripId, viewports: VIEWPORTS }, null, 2)),
    contentType: "application/json",
  });
});
