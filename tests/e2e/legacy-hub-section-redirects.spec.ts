import { expect, test, type Page } from "@playwright/test";
import { handleNormalUserUi, signIn } from "./helpers";

const LEGACY_SECTIONS = [
  ["dates", "dates"],
  ["profile", "profile"],
  ["destination", "destination"],
  ["accommodation", "accommodation"],
  ["transport", "transport"],
  ["planning", "planning"],
  ["tasks", "tasks"],
  ["packing", "packing"],
] as const;

async function firstTripId(page: Page) {
  await page.goto("/dashboard");
  await handleNormalUserUi(page);
  const hrefs = await page.locator('a[href*="/trips/"]').evaluateAll((links) =>
    links.map((link) => (link as HTMLAnchorElement).getAttribute("href") || ""),
  );
  for (const href of hrefs) {
    const match = href.match(/\/trips\/([0-9a-f-]{36})(?:[/?#]|$)/i);
    if (match?.[1]) return match[1];
  }
  throw new Error("TEST_SETUP: no trip is available to validate legacy hub redirects");
}

test("legacy hub section URLs redirect to canonical chapter routes", async ({ page }) => {
  await signIn(page);
  const tripId = await firstTripId(page);

  for (const [section, chapter] of LEGACY_SECTIONS) {
    await page.goto(`/trips/${tripId}?view=voyage&section=${section}`);
    await expect(page).toHaveURL((url) => url.pathname === `/trips/${tripId}/${chapter}`, {
      timeout: 20_000,
    });
  }
});
