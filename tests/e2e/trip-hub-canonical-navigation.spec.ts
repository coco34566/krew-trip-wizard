import { expect, test, type Page } from "@playwright/test";
import { handleNormalUserUi, signIn, userClick } from "./helpers";

const chapters = [
  ["Dates du groupe", "dates"],
  ["Profil du voyage", "profile"],
  ["Destination", "destination"],
  ["Hébergement", "accommodation"],
  ["Transport", "transport"],
  ["Planning", "planning"],
  ["Tâches", "tasks"],
  ["À emporter", "packing"],
] as const;

let preparedTripId: string | null = null;

async function dashboardTripIds(page: Page) {
  await page.goto("/dashboard");
  await handleNormalUserUi(page);
  await expect(page.locator("main")).toBeVisible();

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

async function findPreparedTrip(page: Page) {
  if (preparedTripId) return preparedTripId;

  for (const tripId of await dashboardTripIds(page)) {
    await page.goto(`/trips/${tripId}?view=voyage`);
    await handleNormalUserUi(page);
    await expect(page.locator("main")).toBeVisible();

    const chapterLinks = await Promise.all(
      chapters.map(([, chapter]) =>
        page.locator(`a[href="/trips/${tripId}/${chapter}"]`).count(),
      ),
    );
    if (chapterLinks.every((count) => count > 0)) {
      preparedTripId = tripId;
      return tripId;
    }
  }

  throw new Error("TEST_SETUP: no trip exposes every canonical hub chapter link");
}

test.describe.configure({ mode: "serial" });

for (const [label, chapter] of chapters) {
  test(`hub navigation opens the canonical ${chapter} page`, async ({ page }) => {
    await signIn(page);
    const tripId = await findPreparedTrip(page);
    await page.goto(`/trips/${tripId}?view=voyage`);
    await handleNormalUserUi(page);

    const link = page.locator(`a[href="/trips/${tripId}/${chapter}"]`).first();
    await expect(link, `${label} must be linked from the hub`).toBeVisible({ timeout: 20_000 });
    await userClick(page, link, `open ${chapter} from hub`);
    await expect(page).toHaveURL(new RegExp(`/trips/${tripId}/${chapter}(?:[?#]|$)`));
  });
}

test("legacy section URLs redirect to canonical chapter routes", async ({ page }) => {
  await signIn(page);
  const tripId = await findPreparedTrip(page);

  for (const [, chapter] of chapters) {
    await page.goto(`/trips/${tripId}?view=voyage&section=${chapter}`);
    await handleNormalUserUi(page);
    await expect(page).toHaveURL(new RegExp(`/trips/${tripId}/${chapter}(?:[?#]|$)`));
  }
});
