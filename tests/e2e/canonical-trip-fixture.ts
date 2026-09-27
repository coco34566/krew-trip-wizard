import { expect, type Page } from "@playwright/test";
import { handleNormalUserUi, signIn } from "./helpers";
import { deleteDisposableTrip, disposableTripName } from "./test-lifecycle";

export type CanonicalTripFixture = {
  tripId: string;
  tripName: string;
};

async function waitForSignedInDashboard(page: Page) {
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/, { timeout: 30_000 });
  await handleNormalUserUi(page);
  await expect(page.locator("main")).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState("domcontentloaded");
}

export async function createCanonicalTrip(page: Page): Promise<CanonicalTripFixture> {
  await signIn(page);
  await waitForSignedInDashboard(page);

  await page.goto("/trips/new", { waitUntil: "domcontentloaded" });
  await handleNormalUserUi(page);

  const tripName = disposableTripName("KREW");
  await page.locator("#name").fill(tripName);
  await page.locator("#orga").fill("QA");
  await page.getByRole("button", { name: /25-35 ans/ }).click();
  await page.locator("#n").fill("4");
  await page.locator("#durationDays").fill("3");

  await Promise.all([
    page.waitForURL(/\/trips\/[^/]+\/invite/, { timeout: 30_000 }),
    page.getByRole("button", { name: /Créer et inviter la Krew/ }).click(),
  ]);

  const match = page.url().match(/\/trips\/([^/]+)\/invite/);
  expect(match?.[1], "Canonical fixture trip id should be present in the URL").toBeTruthy();

  const tripId = match![1];
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await handleNormalUserUi(page);
  await expect(page.getByRole("heading", { name: "Inviter la Krew", exact: true })).toBeVisible({
    timeout: 20_000,
  });
  // The invite route can finish one last client-side navigation after waitForURL resolves.
  // Keep the fixture on the page until that navigation has fully settled before callers
  // start a new goto(), otherwise WebKit may abort the next navigation back to /invite.
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(new RegExp(`/trips/${tripId}/invite(?:\\?|$)`));

  return { tripId, tripName };
}

export async function cleanupCanonicalTrip(page: Page, fixture: CanonicalTripFixture | undefined) {
  if (!fixture) return;
  await deleteDisposableTrip(page, fixture.tripId, fixture.tripName);
}
