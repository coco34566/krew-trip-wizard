import { expect, test } from "@playwright/test";
import { cleanupCanonicalTrip, createCanonicalTrip } from "./canonical-trip-fixture";
import { handleNormalUserUi } from "./helpers";

const HUB_STEPS = [
  ["dates", "Dates du groupe"],
  ["profile", "Profil du voyage"],
  ["destination", "Destination"],
  ["accommodation", "Hébergement"],
  ["transport", "Transport"],
  ["planning", "Planning"],
  ["tasks", "Tâches"],
  ["packing", "À emporter"],
] as const;

test("hub journey uses canonical routes without exposing legacy section links", async ({ page }) => {
  let fixture: Awaited<ReturnType<typeof createCanonicalTrip>> | undefined;

  try {
    fixture = await createCanonicalTrip(page);
    const { tripId } = fixture;

    await page.goto(`/trips/${tripId}?view=voyage`, { waitUntil: "domcontentloaded" });
    await handleNormalUserUi(page);

    for (const [, title] of HUB_STEPS) {
      await expect(page.getByRole("heading", { name: title, exact: true }).first()).toBeVisible({
        timeout: 20_000,
      });
    }

    const journeyHrefs = await page.locator(`a[href^="/trips/${tripId}/"]`).evaluateAll((links) =>
      links
        .map((link) => (link as HTMLAnchorElement).getAttribute("href") || "")
        .filter(Boolean),
    );

    expect(journeyHrefs.some((href) => href.includes("section="))).toBe(false);
    expect(journeyHrefs).toContain(`/trips/${tripId}/dates`);

    for (const [chapter] of HUB_STEPS) {
      const matching = journeyHrefs.filter((href) => href === `/trips/${tripId}/${chapter}`);
      expect(matching.length, `${chapter} must never use a non-canonical href when unlocked`).toBeLessThanOrEqual(1);
    }

    const datesLink = page.locator(`a[href="/trips/${tripId}/dates"]`).first();
    await expect(datesLink).toBeVisible({ timeout: 20_000 });
    await datesLink.click();

    await expect(page).toHaveURL((url) => url.pathname === `/trips/${tripId}/dates`, {
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: "Dates du groupe", exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });
  } finally {
    await cleanupCanonicalTrip(page, fixture);
  }
});
