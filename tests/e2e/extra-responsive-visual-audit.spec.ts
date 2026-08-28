import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { handleNormalUserUi, signIn } from "./helpers";

const VIEWPORTS = [
  { name: "mobile-large", width: 430, height: 932 },
  { name: "mobile-landscape", width: 844, height: 390 },
  { name: "tablet-landscape", width: 1112, height: 834 },
  { name: "desktop-wide", width: 1728, height: 1000 },
] as const;

async function settle(page: Page) {
  await handleNormalUserUi(page);
  await expect(page.locator("body")).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForFunction(() => !document.querySelector("main .animate-pulse"), undefined, { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(150);
}

async function capture(page: Page, testInfo: TestInfo, vp: string, name: string, path: string) {
  await page.goto(path);
  await settle(page);
  const geometry = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth, `${vp}/${name}: no horizontal overflow`).toBeLessThanOrEqual(geometry.width + 1);
  const target = testInfo.outputPath(`${vp}-${name}.png`);
  await page.screenshot({ path: target, fullPage: true });
  await testInfo.attach(`${vp}-${name}`, { path: target, contentType: "image/png" });
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
  throw new Error("Responsive audit needs one trip on the QA account");
}

test("landscape and wide responsive audit across customer surfaces", async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  test.skip(testInfo.project.name !== "mobile-safari", "Responsive audit creates target viewports itself.");

  const publicPages = [
    ["landing", "/"], ["auth", "/auth"], ["faq", "/faq"], ["tarifs", "/tarifs"],
    ["a-propos", "/a-propos"], ["mentions-legales", "/mentions-legales"], ["cgu", "/cgu"],
    ["confidentialite", "/confidentialite"],
  ] as const;

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const [name, path] of publicPages) await capture(page, testInfo, viewport.name, name, path);
  }

  await page.setViewportSize({ width: VIEWPORTS[0].width, height: VIEWPORTS[0].height });
  await signIn(page);
  const tripId = await firstTripId(page);

  const authenticatedPages = [
    ["mes-voyages", "/dashboard"], ["account", "/account"], ["trip-create", "/trips/new"],
    ["trip-dashboard", `/trips/${tripId}`], ["invite", `/trips/${tripId}/invite`],
    ["availability", `/trips/${tripId}/availability`], ["preferences", `/trips/${tripId}/questionnaire`],
    ["dates", `/trips/${tripId}?view=voyage&section=dates`], ["profile", `/trips/${tripId}?view=voyage&section=profile`],
    ["destination", `/trips/${tripId}?view=voyage&section=destination`],
    ["accommodation", `/trips/${tripId}?view=voyage&section=accommodation`],
    ["transport", `/trips/${tripId}?view=voyage&section=transport`],
    ["planning", `/trips/${tripId}?view=voyage&section=planning`], ["tasks", `/trips/${tripId}?view=voyage&section=tasks`],
    ["packing", `/trips/${tripId}?view=voyage&section=packing`], ["trip-recap", `/trips/${tripId}/recap`],
    ["memories", `/trips/${tripId}/memories`], ["star", `/trips/${tripId}/star`],
  ] as const;

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const [name, path] of authenticatedPages) await capture(page, testInfo, viewport.name, name, path);
  }
});
