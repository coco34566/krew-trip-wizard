import { expect, test } from "@playwright/test";
import { installDiagnostics, openTrip, qa, signIn } from "./helpers";

test.describe("KREW golden customer journey", () => {
  test("QA account can sign in, create a trip and persist it after reload", async ({ page }, testInfo) => {
    const assertDiagnostics = installDiagnostics(page, testInfo);
    await signIn(page);

    await page.goto("/trips/new");
    const tripName = `E2E-KREW-${Date.now()}`;
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

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/trips/${tripId}/invite`));
    await page.goto("/dashboard");
    await expect(page.getByText(tripName, { exact: false })).toBeVisible();

    await testInfo.attach("created-trip", {
      body: Buffer.from(JSON.stringify({ tripId, tripName }, null, 2)),
      contentType: "application/json",
    });
    await assertDiagnostics();
  });

  test("prepared trip exercises accommodation, transport and planning through the real UI", async ({ page }, testInfo) => {
    test.skip(!qa.existingTripId, "Set KREW_E2E_EXISTING_TRIP_ID to a disposable trip with locked dates and a selected destination.");
    const assertDiagnostics = installDiagnostics(page, testInfo);
    await signIn(page);
    await openTrip(page, qa.existingTripId);

    const accommodation = page.locator("#hub-logistics");
    await expect(accommodation, "Prepared trip must expose the accommodation section").toBeVisible();
    const accommodationButton = accommodation.getByRole("button", { name: /Rechercher des hébergements|Actualiser les offres/ });
    await expect(accommodationButton).toBeVisible();
    await accommodationButton.click();
    await expect(accommodation.getByText(/Voir le logement|prix vérifié|indicatif|à vérifier/i).first()).toBeVisible({ timeout: 120_000 });

    const transports = page.locator("#hub-transports");
    await expect(transports).toBeVisible();
    const transportButton = transports.getByRole("button", { name: /Générer des propositions/ });
    await expect(transportButton).toBeVisible();
    await transportButton.click();
    await expect(transports.getByText(/A\/R|aller|transport/i).first()).toBeVisible({ timeout: 120_000 });

    const planning = page.locator("#hub-activities-plan");
    await expect(planning).toBeVisible();
    const planningButton = planning.getByRole("button", { name: /Générer le planning|Régénérer tout le planning/ });
    await expect(planningButton).toBeVisible();
    await planningButton.click();
    await expect(planning.getByText(/jour 1|planning|programme/i).first()).toBeVisible({ timeout: 120_000 });

    // A successful screen that loses state after refresh is a customer-facing failure.
    const beforeReload = page.url();
    await page.reload();
    await expect(page).toHaveURL(beforeReload);
    await expect(page.locator("#hub-logistics")).toBeVisible();
    await expect(page.locator("#hub-transports")).toBeVisible();
    await expect(page.locator("#hub-activities-plan")).toBeVisible();
    await assertDiagnostics();
  });
});
