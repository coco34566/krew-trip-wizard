import { type Page, type TestInfo } from "@playwright/test";
import { handleNormalUserUi } from "./helpers";
import { isTestTripName, TEST_TRIP_PREFIXES, testTripName } from "./test-trip-constants";

export function disposableTripName(kind: "FULL" | "KREW") {
  return testTripName(kind === "FULL" ? TEST_TRIP_PREFIXES[1] : TEST_TRIP_PREFIXES[0]);
}

export async function deleteDisposableTrip(
  page: Page,
  tripId: string | undefined,
  tripName: string | undefined,
  testInfo?: TestInfo,
) {
  if (!tripId || !tripName || !isTestTripName(tripName)) return false;
  try {
    await page.goto(`/trips/${tripId}`);
    await handleNormalUserUi(page);
    const remove = page.getByRole("button", { name: "Supprimer définitivement", exact: true });
    if (!(await remove.isVisible({ timeout: 10_000 }).catch(() => false))) return false;
    page.once("dialog", (dialog) => dialog.accept());
    await remove.click();
    await page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 30_000 });
    return true;
  } catch (error) {
    if (testInfo) {
      await testInfo.attach("e2e-cleanup-error", {
        body: Buffer.from(String(error)),
        contentType: "text/plain",
      });
    }
    return false;
  }
}
