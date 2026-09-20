import { expect, test, type Page } from "@playwright/test";
import { handleNormalUserUi, signIn } from "./helpers";

const CHAPTERS = [
  { slug: "dates", heading: "Dates du groupe" },
  { slug: "profile", heading: "Profil du voyage" },
  { slug: "destination", heading: "Destination" },
  { slug: "accommodation", heading: "Hébergement" },
  { slug: "transport", heading: "Transport" },
  { slug: "planning", heading: "Planning" },
  { slug: "tasks", heading: /^(Répartir les tâches|Les tâches du groupe|Tâches du voyage)$/ },
  { slug: "packing", heading: "À emporter" },
] as const;

let preparedTripId: string | null = null;

async function dashboardTripIds(page: Page) {
  await page.goto("/dashboard");
  await handleNormalUserUi(page);
  await expect(page.locator("main")).toBeVisible();
  const hrefs = await page.locator('a[href*="/trips/"]').evaluateAll((links) =>
    links.map((link) => (link as HTMLAnchorElement).getAttribute("href") || ""),
  );
  return [...new Set(hrefs.map((href) => href.match(/\/trips\/([0-9a-f-]{36})(?:[/?#]|$)/i)?.[1]).filter(Boolean))] as string[];
}

async function getPreparedTripId(page: Page) {
  if (preparedTripId) return preparedTripId;
  for (const tripId of (await dashboardTripIds(page)).slice(0, 15)) {
    await page.goto(`/trips/${tripId}/planning`);
    await handleNormalUserUi(page);
    if (await page.locator("#hub-activities-plan").isVisible().catch(() => false)) {
      preparedTripId = tripId;
      return tripId;
    }
  }
  throw new Error("TEST_SETUP: no prepared QA trip with a planning was found");
}

test.beforeEach(async ({ page }) => { await signIn(page); });

for (const chapter of CHAPTERS) {
  test(`hub navigation opens the autonomous ${chapter.slug} page`, async ({ page }) => {
    const tripId = await getPreparedTripId(page);
    await page.goto(`/trips/${tripId}?view=voyage`);
    await handleNormalUserUi(page);
    const href = `/trips/${tripId}/${chapter.slug}`;
    const link = page.locator(`a[href="${href}"]`).first();
    await expect(link, `hub must expose ${chapter.slug} canonical route`).toBeVisible({ timeout: 20_000 });
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/trips/${tripId}/${chapter.slug}(?:[?#]|$)`));
    const heading = typeof chapter.heading === "string"
      ? page.getByRole("heading", { name: chapter.heading, exact: true })
      : page.getByRole("heading", { name: chapter.heading });
    await expect(heading.first()).toBeVisible({ timeout: 20_000 });
  });
}

test("legacy section URLs redirect to autonomous routes", async ({ page }) => {
  const tripId = await getPreparedTripId(page);
  for (const chapter of CHAPTERS) {
    await page.goto(`/trips/${tripId}?view=voyage&section=${chapter.slug}`);
    await handleNormalUserUi(page);
    await expect(page).toHaveURL(new RegExp(`/trips/${tripId}/${chapter.slug}(?:[?#]|$)`));
  }
});
