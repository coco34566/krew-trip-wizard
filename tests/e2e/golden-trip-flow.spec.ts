import { expect, test } from "@playwright/test";
import { installDiagnostics, signIn } from "./helpers";
import { deleteDisposableTrip, disposableTripName } from "./test-lifecycle";

test.describe("KREW golden smoke journey", () => {
  let createdTripId: string | undefined;
  let createdTripName: string | undefined;

  test.afterEach(async ({ page }, testInfo) => {
    await deleteDisposableTrip(page, createdTripId, createdTripName, testInfo);
    createdTripId = undefined;
    createdTripName = undefined;
  });

  test("QA account can sign in, create a trip and persist it after reload", async ({ page }, testInfo) => {
    const assertDiagnostics = installDiagnostics(page, testInfo);
    await signIn(page);
    await page.goto("/trips/new");
    const tripName = disposableTripName("KREW");
    createdTripName = tripName;
    await page.locator("#name").fill(tripName);
    await page.locator("#orga").fill("QA");
    await page.getByRole("button", { name: /25-35 ans/ }).click();
    await page.locator("#n").fill("4");
    await page.locator("#durationDays").fill("3");
    await Promise.all([
      page.waitForURL(/\/trips\/[^/]+\/invite/, { timeout: 30_000 }),
      page.getByRole("button", { name: /Créer et inviter le groupe/ }).click(),
    ]);
    const match = page.url().match(/\/trips\/([^/]+)\/invite/);
    expect(match?.[1], "Created trip id should be present in the URL").toBeTruthy();
    const tripId = match![1];
    createdTripId = tripId;
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/trips/${tripId}/invite`));
    await page.goto("/dashboard");
    await expect(page.getByText(tripName, { exact: false })).toBeVisible();
    await testInfo.attach("created-trip", { body: Buffer.from(JSON.stringify({ tripId, tripName }, null, 2)), contentType: "application/json" });
    await assertDiagnostics();
  });
});
