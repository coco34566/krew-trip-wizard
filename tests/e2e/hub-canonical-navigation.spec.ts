import { expect, test, type Page } from "@playwright/test";
import { handleNormalUserUi, signIn } from "./helpers";

const HUB_STEPS = [
  ["dates", "Dates du groupe"],
  ["profile", "Profil du voyage"],
  ["destination", "Destination"],
  ["accommodation", "Hébergement"],
  ["transport", "Transport"],
  ["planning", "Planning"],
  ["tasks", /^(Répartir les tâches|Les tâches du groupe|Tâches du voyage)$/],
  ["packing", "À emporter"],
] as const;

async function openDashboard(page: Page) {
  const currentPath = new URL(page.url()).pathname;
  if (currentPath !== "/dashboard") {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  } else {
    await page.waitForLoadState("domcontentloaded");
  }
  await handleNormalUserUi(page);
  await expect(page.locator("main")).toBeVisible({ timeout: 20_000 });
}

async function dashboardTripIds(page: Page) {
  await openDashboard(page);
  const hrefs = await page.locator('a[href*="/trips/"]').evaluateAll((links) =>
    links.map((link) => (link as HTMLAnchorElement).getAttribute("href") || ""),
  );
  const ids: string[] = [];
  for (const href of hrefs) {
    const match = href.match(/\/trips\/([0-9a-f-]{36})(?:[/?#]|$)/i);
    if (match?.[1] && !ids.includes(match[1])) ids.push(match[1]);
  }
  return ids.slice(0, 20);
}

async function findPreparedHubTrip(page: Page) {
  const ids = await dashboardTripIds(page);
  for (const tripId of ids) {
    await page.goto(`/trips/${tripId}?view=voyage`);
    await handleNormalUserUi(page);
    const planningLink = page.locator(`a[href="/trips/${tripId}/planning"]`).first();
    if (await planningLink.isVisible().catch(() => false)) return tripId;
  }
  throw new Error("TEST_SETUP: no prepared trip exposes the canonical hub journey links");
}

for (const [chapter, heading] of HUB_STEPS) {
  test(`hub navigation opens canonical ${chapter} page`, async ({ page }) => {
    await signIn(page);
    const tripId = await findPreparedHubTrip(page);
    await page.goto(`/trips/${tripId}?view=voyage`);
    await handleNormalUserUi(page);

    const link = page.locator(`a[href="/trips/${tripId}/${chapter}"]`).first();
    await expect(link, `hub must expose ${chapter} as a canonical link`).toBeVisible({
      timeout: 20_000,
    });
    await link.click();

    await expect(page).toHaveURL((url) => url.pathname === `/trips/${tripId}/${chapter}`, {
      timeout: 20_000,
    });
    await handleNormalUserUi(page);
    await expect(page.getByRole("heading", { name: heading as string | RegExp }).first()).toBeVisible({
      timeout: 20_000,
    });
  });
}
