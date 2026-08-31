import { test, expect, type Page } from "@playwright/test";

import { handleNormalUserUi } from "./helpers";
import { getCompletedTripUserFixtureFromEnv } from "./manual-completed-trip-user.fixture";

async function signInAs(page: Page, email: string, password: string) {
  await page.goto("/auth");
  await handleNormalUserUi(page);
  await page.getByRole("tab", { name: "Connexion" }).click();
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 30_000 });
}

async function assertNoPreparationCtas(page: Page) {
  for (const label of [
    "La suite se prépare",
    "Prochaine action",
    "Voter pour un hébergement",
    "Choisir mon trajet",
    "Affiner l’organisation",
    "Relancer le groupe",
  ]) {
    await expect(page.getByText(label, { exact: false })).toHaveCount(0);
  }
}

async function assertCompletedTrip(page: Page) {
  await expect(page.getByText("Voyage terminé", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/compléter.*disponibil/i)).toHaveCount(0);
  await expect(page.getByText(/répondre.*préfér/i)).toHaveCount(0);
  await expect(page.getByText(/choisir.*destination/i)).toHaveCount(0);
  await assertNoPreparationCtas(page);
}

async function gotoTripSection(page: Page, tripId: string, section?: string) {
  const search = section ? `?view=voyage&section=${section}` : "?view=voyage";
  await page.goto(`/trips/${tripId}${search}`);
  await page.waitForLoadState("networkidle");
}

async function assertHistoricalJourney(page: Page) {
  await expect(page.getByText("Historique du voyage", { exact: true })).toBeVisible();
  await expect(page.getByText("On en est ici", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Disponible", { exact: true })).toHaveCount(0);
  await expect(page.getByText("À venir", { exact: true })).toHaveCount(0);
  await expect(page.getByText("On prépare le départ", { exact: true })).toHaveCount(0);
  await expect(page.getByText("La suite s’écrit avec la Krew", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Voir les souvenirs/i }).first()).toBeVisible();
}

async function assertHistoricalPlanning(page: Page) {
  await expect(page.getByText("Voyage terminé · consultation", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Préparer le planning|Revoir le planning|Autre option/i })).toHaveCount(0);
  await expect(page.getByText("Répartir les tâches", { exact: true })).toHaveCount(0);
}

async function assertHistoricalTasks(page: Page) {
  await expect(page.getByRole("heading", { name: "Tâches du voyage", exact: true })).toBeVisible();
  await expect(page.getByText(/participants? encore à inviter/i)).toHaveCount(0);
  await expect(page.getByText(/Invite-les avant/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Inviter le groupe|Préparer les tâches|Actualiser les tâches/i })).toHaveCount(0);
  await expect(page.locator("select[aria-label^='Responsable de']")).toHaveCount(0);
  await expect(page.locator("select[aria-label^='Statut de']")).toHaveCount(0);
}

async function assertHistoricalPacking(page: Page) {
  await expect(page.getByText(/à compléter avec le groupe/i)).toHaveCount(0);
  await expect(page.getByPlaceholder("Ajouter un élément")).toHaveCount(0);
  await expect(page.locator("select[aria-label^='Assigner']")).toHaveCount(0);
  await expect(page.getByText("À répartir dans les tâches", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Cocher / })).toHaveCount(0);
}

/**
 * MANUAL-ONLY USER TEST — completed trip / end-of-trip experience.
 * Never add this file to test:ci or to an automatic push/PR workflow.
 */
test.describe("manual user test — completed trip", () => {
  test.skip(
    !process.env.KREW_COMPLETED_TRIP_URL,
    "Manual-only: set KREW_COMPLETED_TRIP_URL to the dedicated completed-trip fixture URL.",
  );

  test("organizer understands the completed state and can archive/reactivate it", async ({ page }) => {
    const fixture = getCompletedTripUserFixtureFromEnv();
    const email = process.env.KREW_E2E_EMAIL ?? "";
    const password = process.env.KREW_E2E_PASSWORD ?? "";
    test.skip(!email || !password, "Manual-only: organizer E2E credentials are required.");

    await signInAs(page, email, password);
    await page.goto(fixture.organizerUrl);
    await page.waitForLoadState("networkidle");
    await assertCompletedTrip(page);

    await gotoTripSection(page, fixture.tripId);
    await assertHistoricalJourney(page);

    await gotoTripSection(page, fixture.tripId, "planning");
    await assertHistoricalPlanning(page);

    await gotoTripSection(page, fixture.tripId, "tasks");
    await assertHistoricalTasks(page);

    await gotoTripSection(page, fixture.tripId, "packing");
    await assertHistoricalPacking(page);

    await page.goto(fixture.organizerUrl);
    const archiveButton = page.getByRole("button", { name: /Archiver(?: le voyage)?/, exact: true }).first();
    if (await archiveButton.isVisible().catch(() => false)) {
      await archiveButton.click();
      const confirmArchive = page.getByRole("button", { name: "Archiver", exact: true });
      if (await confirmArchive.isVisible().catch(() => false)) await confirmArchive.click();
      await page.goto("/dashboard");
      await expect(page.getByRole("heading", { name: "Voyages archivés" })).toBeVisible();
      await expect(page.getByText(fixture.tripName, { exact: true }).first()).toBeVisible();
      await page.getByRole("button", { name: "Réactiver", exact: true }).first().click();
      await page.goto(fixture.organizerUrl);
      await assertCompletedTrip(page);
    }
  });

  test("participant sees a coherent read-only completed-trip experience", async ({ page }) => {
    const fixture = getCompletedTripUserFixtureFromEnv();
    const email = process.env.KREW_COMPLETED_TRIP_PARTICIPANT_EMAIL ?? "";
    const password = process.env.KREW_COMPLETED_TRIP_PARTICIPANT_PASSWORD ?? "";
    test.skip(!fixture.participantUrl || !email || !password, "Manual-only: participant fixture URL and credentials are required.");

    await signInAs(page, email, password);
    await page.goto(fixture.participantUrl!);
    await page.waitForLoadState("networkidle");
    await assertCompletedTrip(page);
    await expect(page.getByRole("button", { name: /Archiver(?: le voyage)?/ })).toHaveCount(0);

    await gotoTripSection(page, fixture.tripId);
    await assertHistoricalJourney(page);
    await gotoTripSection(page, fixture.tripId, "planning");
    await assertHistoricalPlanning(page);
    await gotoTripSection(page, fixture.tripId, "tasks");
    await assertHistoricalTasks(page);
    await gotoTripSection(page, fixture.tripId, "packing");
    await assertHistoricalPacking(page);
  });
});
