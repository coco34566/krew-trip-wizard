import { expect, test } from "@playwright/test";
import { cleanupCanonicalTrip, createCanonicalTrip } from "./canonical-trip-fixture";

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

test("legacy hub section URLs redirect to canonical chapter routes", async ({ page }) => {
  let fixture: Awaited<ReturnType<typeof createCanonicalTrip>> | undefined;

  try {
    fixture = await createCanonicalTrip(page);
    const { tripId } = fixture;

    for (const [section, chapter] of LEGACY_SECTIONS) {
      await test.step(section, async () => {
        await page.goto(`/trips/${tripId}?view=voyage&section=${section}`, {
          waitUntil: "domcontentloaded",
        });
        await expect(page).toHaveURL((url) => url.pathname === `/trips/${tripId}/${chapter}`, {
          timeout: 20_000,
        });
      });
    }
  } finally {
    await cleanupCanonicalTrip(page, fixture);
  }
});
