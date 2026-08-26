import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { handleNormalUserUi, signIn, userClick } from "./helpers";

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
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForFunction(() => !document.querySelector("main .animate-pulse"), undefined, { timeout: 15_000 }).catch(() => undefined);

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

async function createVisualAuditTrip(page: Page) {
  await page.goto("/trips/new");
  await handleNormalUserUi(page);
  await expect(page.locator("#name")).toBeVisible();
  await page.locator("#name").fill(`VISUAL-AUDIT-${Date.now()}`);
  await page.locator("#orga").fill("QA");
  await userClick(page, page.getByRole("button", { name: /25-35 ans/ }), "choose visual-audit age range");
  await page.locator("#n").fill("2");
  await page.locator("#durationDays").fill("3");
  await Promise.all([
    page.waitForURL(/\/trips\/[^/]+\/invite/, { timeout: 30_000 }),
    userClick(page, page.getByRole("button", { name: /Créer et inviter le groupe/ }), "create visual-audit trip"),
  ]);
  const tripId = page.url().match(/\/trips\/([0-9a-f-]{36})\/invite/i)?.[1];
  expect(tripId, "Visual audit trip should expose a UUID in the URL").toBeTruthy();
  return tripId!;
}

async function findAuditTrip(page: Page) {
  const ids = await dashboardTripIds(page);

  for (const id of ids) {
    await page.goto(`/trips/${id}?view=voyage&section=planning`);
    await handleNormalUserUi(page);
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    await page.waitForFunction(() => !document.querySelector("main .animate-pulse"), undefined, { timeout: 15_000 }).catch(() => undefined);
    if (await page.locator("#hub-activities-plan").isVisible().catch(() => false)) return id;
  }

  return createVisualAuditTrip(page);
}

async function waitForVisibleImages(page: Page) {
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("main img")).every((node) => {
        const img = node as HTMLImageElement;
        const box = img.getBoundingClientRect();
        const style = getComputedStyle(img);
        const visible =
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          box.width > 0 &&
          box.height > 0;
        return !visible || img.complete;
      }),
    undefined,
    { timeout: 10_000 },
  ).catch(() => undefined);
}

async function waitForRenderedChapter(page: Page, name: string) {
  await expect(page.locator("main")).toBeVisible();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

  // Never approve a screenshot while KREW is still showing its page skeleton.
  await page.waitForFunction(
    () => !document.querySelector("main .animate-pulse"),
    undefined,
    { timeout: 20_000 },
  );

  // Chapters that are always rendered must expose real content before capture.
  const required: Record<string, () => ReturnType<Page["locator"]>> = {
    invite: () => page.getByRole("heading", { name: "Inviter le groupe", exact: true }),
    availability: () => page.locator('main img[src*="/brand/otter-states/availability.png"]'),
    preferences: () => page.locator("main form").first(),
    dates: () => page.locator("#hub-dates"),
    destination: () => page.locator("#hub-destination"),
    transport: () => page.locator("#hub-transports"),
    packing: () => page.getByRole("heading", { name: "À emporter", exact: true }),
  };

  const marker = required[name]?.();
  if (marker) {
    await expect(marker, `${name}: real chapter content must render before screenshot`).toBeVisible({ timeout: 20_000 });
  }

  await waitForVisibleImages(page);
  // Give CSS background/decorative assets one frame after network/image settlement.
  await page.waitForTimeout(150);
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
  await waitForRenderedChapter(page, name);

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

  await page.goto(`/trips/${tripId}/star`);
  await handleNormalUserUi(page);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForFunction(() => !document.querySelector("main .animate-pulse"), undefined, { timeout: 20_000 }).catch(() => undefined);
  await waitForVisibleImages(page);
  if (await page.locator("main h1").isVisible().catch(() => false)) {
    const screenshotPath = testInfo.outputPath(`${viewportName}-star.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach(`${viewportName}-star`, { path: screenshotPath, contentType: "image/png" });
  }
}

test("visual audit of every customer-journey chapter without provider calls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-safari", "Visual audit runs once and creates all target viewports itself.");
  const metrics: VisualMetric[] = [];

  await page.setViewportSize({ width: VIEWPORTS[0].width, height: VIEWPORTS[0].height });
  await signIn(page);
  const tripId = await findAuditTrip(page);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await captureJourney(page, testInfo, metrics, viewport.name, tripId);
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
