import { expect, test, type Page } from "@playwright/test";
import { handleNormalUserUi, signIn, userClick } from "./helpers";

const CHAPTERS = [
  { id: "dates", heading: "Dates du groupe" },
  { id: "profile", heading: "Profil du voyage" },
  { id: "destination", heading: "Destination" },
  { id: "accommodation", heading: "Hébergement" },
  { id: "transport", heading: "Transport" },
  { id: "planning", heading: "Planning" },
  { id: "tasks", heading: /^(Répartir les tâches|Les tâches du groupe|Tâches du voyage)$/ },
  { id: "packing", heading: "À emporter" },
] as const;

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

async function findHubLink(page: Page, chapter: string) {
  const ids = await dashboardTripIds(page);
  for (const tripId of ids) {
    await page.goto(`/trips/${tripId}?view=voyage`);
    await handleNormalUserUi(page);
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    const link = page.locator(`a[href="/trips/${tripId}/${chapter}"]`).first();
    if (await link.isVisible().catch(() => false)) return { tripId, link };
  }
  throw new Error(`TEST_SETUP: no hub trip exposes the ${chapter} chapter link`);
}

test.describe("hub autonomous chapter navigation", () => {
  for (const chapter of CHAPTERS) {
    test(`hub opens ${chapter.id} on its autonomous route`, async ({ page }) => {
      await signIn(page);
      const { tripId, link } = await findHubLink(page, chapter.id);
      await userClick(page, link, `open ${chapter.id} from hub`);
      await expect(page).toHaveURL(new RegExp(`/trips/${tripId}/${chapter.id}(?:\\?|$)`));
      const heading = typeof chapter.heading === "string"
        ? page.getByRole("heading", { name: chapter.heading, exact: true })
        : page.getByRole("heading", { name: chapter.heading });
      await expect(heading).toBeVisible({ timeout: 20_000 });
    });
  }
});

test.describe("legacy hub chapter URLs", () => {
  for (const chapter of CHAPTERS) {
    test(`legacy section=${chapter.id} redirects to the autonomous route`, async ({ page }) => {
      await signIn(page);
      const ids = await dashboardTripIds(page);
      expect(ids.length, "QA account should expose at least one trip").toBeGreaterThan(0);
      const tripId = ids[0]!;
      await page.goto(`/trips/${tripId}?view=voyage&section=${chapter.id}`);
      await expect(page).toHaveURL(new RegExp(`/trips/${tripId}/${chapter.id}(?:\\?|$)`), { timeout: 20_000 });
    });
  }
});
