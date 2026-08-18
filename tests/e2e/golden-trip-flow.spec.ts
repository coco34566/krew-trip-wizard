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
    await testInfo.attach("created-trip", { body: Buffer.from(JSON.stringify({ tripId, tripName }, null, 2)), contentType: "application/json" });
    await assertDiagnostics();
  });

  test("prepared trip exercises accommodation, transport and planning through the real UI", async ({ page }, testInfo) => {
    test.skip(!qa.existingTripId, "Set KREW_E2E_EXISTING_TRIP_ID to a disposable trip with locked dates and a selected destination.");
    test.skip(testInfo.project.name !== "mobile-safari", "Run the API-consuming golden path once only to keep provider usage deterministic.");
    const assertDiagnostics = installDiagnostics(page, testInfo);
    await signIn(page);
    await openTrip(page, qa.existingTripId);
    const accommodation = page.locator("#hub-logistics");
    await expect(accommodation).toBeVisible();
    const accommodationButton = accommodation.getByRole("button", { name: /Rechercher des hébergements|Actualiser les offres/ });
    await expect(accommodationButton).toBeVisible();
    await expect(accommodationButton).toBeEnabled();
    const serverResponses: Array<{ url: string; status: number; body: string }> = [];
    page.on("response", async (response) => {
      if (!response.url().includes("/_serverFn/")) return;
      let body = "";
      try { body = (await response.text()).slice(0, 2500); } catch { body = "<unreadable>"; }
      serverResponses.push({ url: response.url(), status: response.status(), body });
    });
    await accommodationButton.click();
    await expect.poll(() => serverResponses.length, { timeout: 30_000 }).toBeGreaterThan(0);
    const success = accommodation.getByText(/Voir le logement|prix vérifié|indicatif|à vérifier|Recherche web Tavily/i).first();
    const errorToast = page.getByText(/Recherche d.hebergements impossible|Erreur lors de la recherche des logements|no_tavily_key|no_gemini_key|rate_limited|quota|provider_unavailable/i).first();
    await Promise.race([success.waitFor({ state: "visible", timeout: 120_000 }), errorToast.waitFor({ state: "visible", timeout: 120_000 })]).catch(() => undefined);
    await testInfo.attach("accommodation-server-responses", { body: Buffer.from(JSON.stringify(serverResponses, null, 2)), contentType: "application/json" });
    if (await errorToast.isVisible().catch(() => false)) throw new Error(`Accommodation generation failed in real UI: ${(await errorToast.textContent()) ?? "unknown error"}`);
    await expect(success).toBeVisible({ timeout: 5_000 });
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
    const beforeReload = page.url();
    await page.reload();
    await expect(page).toHaveURL(beforeReload);
    await expect(page.locator("#hub-logistics")).toBeVisible();
    await expect(page.locator("#hub-transports")).toBeVisible();
    await expect(page.locator("#hub-activities-plan")).toBeVisible();
    await assertDiagnostics();
  });
});
