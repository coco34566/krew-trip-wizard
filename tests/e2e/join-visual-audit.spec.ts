import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { handleNormalUserUi, signIn, userClick } from "./helpers";

const VIEWPORTS = [
  { name: "narrow-mobile", width: 320, height: 568, screenshot: false },
  { name: "mobile", width: 390, height: 844, screenshot: true },
  { name: "mobile-landscape", width: 844, height: 390, screenshot: false },
  { name: "tablet", width: 834, height: 1112, screenshot: true },
  { name: "tablet-landscape", width: 1112, height: 834, screenshot: false },
  { name: "desktop", width: 1440, height: 1000, screenshot: true },
  { name: "wide-desktop", width: 1728, height: 1100, screenshot: false },
] as const;

type JoinMetric = {
  viewport: string;
  state: string;
  width: number;
  scrollWidth: number;
};

async function createAuditTrip(page: Page) {
  await page.goto("/trips/new");
  await handleNormalUserUi(page);
  await expect(page.locator("#name")).toBeVisible();
  await page.locator("#name").fill(`JOIN-VISUAL-AUDIT-${Date.now()}`);
  await page.locator("#orga").fill("QA");
  await userClick(page, page.getByRole("button", { name: /25-35 ans/ }), "choose join visual-audit age range");
  await page.locator("#n").fill("2");
  await page.locator("#durationDays").fill("3");
  await Promise.all([
    page.waitForURL(/\/trips\/[^/]+\/invite/, { timeout: 30_000 }),
    userClick(page, page.getByRole("button", { name: /Créer et inviter la Krew/ }), "create join visual-audit trip"),
  ]);
  const tripId = page.url().match(/\/trips\/([0-9a-f-]{36})\/invite/i)?.[1];
  expect(tripId, "Join visual audit trip should expose a UUID").toBeTruthy();
  return tripId!;
}

async function readRealInviteUrl(page: Page, tripId: string) {
  await page.goto(`/trips/${tripId}/invite`);
  await handleNormalUserUi(page);
  const copyButton = page.getByRole("button", { name: /Copier le lien d’invitation/i });
  await expect(copyButton).toBeVisible({ timeout: 20_000 });
  await expect(copyButton).toBeEnabled({ timeout: 20_000 });

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await copyButton.click();
  const inviteUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(inviteUrl).toMatch(new RegExp(`/join/${tripId}\\?token=[0-9a-f-]{36}$`, "i"));
  return inviteUrl;
}

async function clearAuthentication(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();
}

async function settleJoin(page: Page) {
  await handleNormalUserUi(page);
  await expect(page.locator("main")).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForFunction(() => !document.querySelector("main .animate-pulse"), undefined, { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(100);
}

async function captureState(
  page: Page,
  testInfo: TestInfo,
  metrics: JoinMetric[],
  viewport: (typeof VIEWPORTS)[number],
  state: string,
  path: string,
  expectedHeading: RegExp,
) {
  await page.goto(path);
  await settleJoin(page);
  await expect(page.getByRole("heading", { name: expectedHeading }).first()).toBeVisible({ timeout: 20_000 });

  const geometry = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  metrics.push({ viewport: viewport.name, state, ...geometry });
  expect(geometry.scrollWidth, `${viewport.name}/${state}: no horizontal overflow`).toBeLessThanOrEqual(geometry.width + 1);

  if (!viewport.screenshot) return;
  const screenshotPath = testInfo.outputPath(`${viewport.name}-join-${state}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach(`${viewport.name}-join-${state}`, { path: screenshotPath, contentType: "image/png" });
}

test("join invitation visual states use a real invite token", async ({ page }, testInfo) => {
  test.setTimeout(360_000);
  test.skip(testInfo.project.name !== "mobile-safari", "Join visual audit creates all target viewports itself.");

  await page.setViewportSize({ width: VIEWPORTS[0].width, height: VIEWPORTS[0].height });
  await signIn(page);
  const tripId = await createAuditTrip(page);
  const inviteUrl = await readRealInviteUrl(page, tripId);
  const invitePath = new URL(inviteUrl).pathname + new URL(inviteUrl).search;
  const token = new URL(inviteUrl).searchParams.get("token");
  expect(token).toMatch(/^[0-9a-f-]{36}$/i);

  // A recognized organizer/member must never remain on Join. A brand-new audit trip
  // has no answers yet, so the canonical redirect is the availability chapter.
  await page.goto(invitePath);
  await expect(page).toHaveURL(new RegExp(`/trips/${tripId}/availability(?:\\?|$)`), { timeout: 20_000 });

  await clearAuthentication(page);

  const invalidToken = "00000000-0000-4000-8000-000000000000";
  const states = [
    {
      name: "valid-invite",
      path: invitePath,
      heading: new RegExp("JOIN-VISUAL-AUDIT-", "i"),
    },
    {
      name: "missing-token",
      path: `/join/${tripId}`,
      heading: /Impossible d'ouvrir l'invitation/i,
    },
    {
      name: "invalid-token",
      path: `/join/${tripId}?token=${invalidToken}`,
      heading: /Impossible d'ouvrir l'invitation/i,
    },
    {
      name: "malformed-trip",
      path: `/join/not-a-valid-trip?token=${token}`,
      heading: /Impossible d'ouvrir l'invitation/i,
    },
  ] as const;

  const metrics: JoinMetric[] = [];
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const state of states) {
      await captureState(page, testInfo, metrics, viewport, state.name, state.path, state.heading);
    }
  }

  await testInfo.attach("join-visual-audit-metrics", {
    body: Buffer.from(JSON.stringify({ tripId, states: states.map((state) => state.name), metrics }, null, 2)),
    contentType: "application/json",
  });
});
