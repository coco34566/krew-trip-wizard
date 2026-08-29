import { expect, type Page, type TestInfo } from "@playwright/test";
import { handleNormalUserUi } from "./helpers";

export const DISPOSABLE_TRIP_NAME = /^E2E-(?:FULL|KREW)-\d{10,}$/;

export function disposableTripName(kind: "FULL" | "KREW") {
  return `E2E-${kind}-${Date.now()}`;
}

export async function deleteDisposableTrip(page: Page, tripId: string | undefined, tripName: string | undefined, testInfo?: TestInfo) {
  if (!tripId || !tripName || !DISPOSABLE_TRIP_NAME.test(tripName)) return false;
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
    if (testInfo) await testInfo.attach("e2e-cleanup-error", { body: Buffer.from(String(error)), contentType: "text/plain" });
    return false;
  }
}

export async function assertNoDisposableTripsOnDashboard(page: Page) {
  await page.goto("/dashboard");
  await handleNormalUserUi(page);
  await expect(page.locator("main")).toBeVisible({ timeout: 20_000 });
  const names = await page.locator('a[href*="/trips/"]').allTextContents();
  expect(names.filter((name) => DISPOSABLE_TRIP_NAME.test(name.replace(/\s+/g, " ").trim()))).toEqual([]);
}
