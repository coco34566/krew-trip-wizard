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
  ["tasks", /^(Répartir les tâches|Les tâches du groupe|Tâches du voyage)$/],
  ["packing", "À emporter"],
] as const;

test("hub navigation opens every canonical journey page", async ({ page }) => {
  let fixture: Awaited<ReturnType<typeof createCanonicalTrip>> | undefined;

  try {
    fixture = await createCanonicalTrip(page);
    const { tripId } = fixture;

    for (const [chapter, heading] of HUB_STEPS) {
      await test.step(chapter, async () => {
        await page.goto(`/trips/${tripId}?view=voyage`, { waitUntil: "domcontentloaded" });
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
  } finally {
    await cleanupCanonicalTrip(page, fixture);
  }
});
