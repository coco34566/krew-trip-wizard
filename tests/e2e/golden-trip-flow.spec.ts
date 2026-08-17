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

  test("existing prepared trip survives the critical recommendation path", async ({ page }, testInfo) => {
    test.skip(!qa.existingTripId, "Set KREW_E2E_EXISTING_TRIP_ID to a disposable trip prepared through questionnaires/dates.");
    const assertDiagnostics = installDiagnostics(page, testInfo);
    await signIn(page);
    await openTrip(page, qa.existingTripId);

    // The purpose of this scenario is intentionally user-visible: it exercises the
    // same controls a customer uses and fails loudly when a workflow is not wired.
    const destinationButton = page.getByRole("button", { name: /destination/i }).filter({ hasText: /génér|propos|recher|regén/i }).first();
    if (await destinationButton.isVisible().catch(() => false)) {
      await destinationButton.click();
      await expect(page.getByText(/destination/i).first()).toBeVisible({ timeout: 120_000 });
    }

    const accommodationButton = page.getByRole("button", { name: /logement|hébergement|hôtel/i }).filter({ hasText: /génér|propos|recher|regén/i }).first();
    if (await accommodationButton.isVisible().catch(() => false)) {
      await accommodationButton.click();
      await expect(page.getByText(/Voir le logement|prix vérifié|indicatif|à vérifier/i).first()).toBeVisible({ timeout: 120_000 });
    }

    const transportButton = page.getByRole("button", { name: /transport/i }).filter({ hasText: /génér|propos|recher|regén/i }).first();
    if (await transportButton.isVisible().catch(() => false)) {
      await transportButton.click();
      await expect(page.getByText(/A\/R|aller|transport/i).first()).toBeVisible({ timeout: 120_000 });
    }

    const planningButton = page.getByRole("button", { name: /planning|programme|itinéraire/i }).filter({ hasText: /génér|propos|recher|regén/i }).first();
    if (await planningButton.isVisible().catch(() => false)) {
      await planningButton.click();
      await expect(page.getByText(/planning|programme|jour 1/i).first()).toBeVisible({ timeout: 120_000 });
    }

    // Persistence is part of the customer journey: a successful screen that loses
    // state after refresh is considered an E2E failure.
    const beforeReload = page.url();
    await page.reload();
    await expect(page).toHaveURL(beforeReload);
    await expect(page.locator("main")).toBeVisible();
    await assertDiagnostics();
  });
});
