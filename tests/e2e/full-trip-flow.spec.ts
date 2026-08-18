import { expect, test } from "@playwright/test";
import { installDiagnostics, signIn } from "./helpers";

test("single full KREW journey from zero to planning", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-safari", "Full provider-consuming journey runs once only.");
  const assertDiagnostics = installDiagnostics(page, testInfo);
  const serverResponses: Array<{ stage: string; url: string; status: number; body: string }> = [];
  let stage = "setup";
  page.on("response", async (response) => {
    if (!response.url().includes("/_serverFn/")) return;
    let body = "";
    try { body = (await response.text()).slice(0, 3000); } catch { body = "<unreadable>"; }
    serverResponses.push({ stage, url: response.url(), status: response.status(), body });
  });

  await signIn(page);

  stage = "create-trip";
  await page.goto("/trips/new");
  const tripName = `E2E-FULL-${Date.now()}`;
  await page.locator("#name").fill(tripName);
  await page.locator("#orga").fill("QA");
  await page.getByRole("button", { name: /25-35 ans/ }).click();
  await page.locator("#n").fill("2");
  await page.locator("#durationDays").fill("3");
  await Promise.all([
    page.waitForURL(/\/trips\/[^/]+\/invite/, { timeout: 30_000 }),
    page.getByRole("button", { name: /Créer et inviter le groupe/ }).click(),
  ]);
  const tripId = page.url().match(/\/trips\/([^/]+)\/invite/)?.[1];
  expect(tripId).toBeTruthy();

  stage = "availability";
  await page.goto(`/trips/${tripId}/availability`);
  await page.getByRole("button", { name: /Tous les week-ends affichés/ }).click();
  const saveAvailability = page.getByRole("button", { name: /Enregistrer mes disponibilités/ });
  await expect(saveAvailability).toBeEnabled();
  await saveAvailability.click();
  await page.waitForURL(new RegExp(`/trips/${tripId}/?$`), { timeout: 30_000 });

  stage = "preferences";
  await page.goto(`/trips/${tripId}/questionnaire`);
  await page.getByRole("button", { name: "🧖 Détente", exact: true }).click();
  await page.getByRole("button", { name: "🏛️ Musées & culture", exact: true }).click();
  await page.getByRole("button", { name: "🏢 Centre-ville / urbain", exact: true }).click();
  await page.locator("#departure").fill("Paris");
  const cityChoice = page.getByRole("button", { name: /Paris France/ }).first();
  if (await cityChoice.isVisible().catch(() => false)) await cityChoice.click();
  await page.getByRole("button", { name: /Envoyer mes réponses/ }).click();
  await page.waitForURL(new RegExp(`/trips/${tripId}/?$`), { timeout: 30_000 });

  stage = "lock-dates";
  const dates = page.locator("#hub-dates");
  await expect(dates).toBeVisible();
  const lockButton = dates.getByRole("button", { name: /Valider|Choisir|Verrouiller/i }).first();
  await expect(lockButton, "Fresh trip must expose an organizer date action").toBeVisible({ timeout: 20_000 });
  await lockButton.click();
  await expect(dates.getByText(/verrouill|validée|choisie/i).first()).toBeVisible({ timeout: 30_000 });

  stage = "destinations";
  const destinations = page.locator("#hub-destination");
  await expect(destinations).toBeVisible();
  const generateDestinations = destinations.getByRole("button", { name: /Générer|Régénérer|Proposer/i }).first();
  await expect(generateDestinations).toBeVisible({ timeout: 20_000 });
  await generateDestinations.click();
  const selectDestination = destinations.getByRole("button", { name: /Choisir|Valider|Sélectionner/i }).first();
  await expect(selectDestination, "Destination generation must return a selectable proposal").toBeVisible({ timeout: 120_000 });
  await selectDestination.click();
  await expect(page.locator("#hub-logistics")).toBeVisible({ timeout: 30_000 });

  stage = "accommodation";
  const accommodation = page.locator("#hub-logistics");
  const accommodationButton = accommodation.getByRole("button", { name: /Rechercher des hébergements|Actualiser les offres/ });
  await expect(accommodationButton).toBeVisible();
  await accommodationButton.click();
  await expect(accommodation.getByText(/Recherche web Tavily|Voir le logement|indicatif|à vérifier/i).first()).toBeVisible({ timeout: 120_000 });

  stage = "transport";
  const transports = page.locator("#hub-transports");
  const transportButton = transports.getByRole("button", { name: /Générer des propositions/ });
  await expect(transportButton).toBeVisible();
  await transportButton.click();
  await expect(transports.getByText(/A\/R|aller|transport/i).first()).toBeVisible({ timeout: 120_000 });

  stage = "planning";
  const planning = page.locator("#hub-activities-plan");
  const planningButton = planning.getByRole("button", { name: /Générer le planning|Régénérer tout le planning/ });
  await expect(planningButton).toBeVisible();
  await planningButton.click();
  await expect(planning.getByText(/jour 1|planning|programme/i).first()).toBeVisible({ timeout: 120_000 });

  stage = "persistence";
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/trips/${tripId}/?$`));
  await expect(page.locator("#hub-logistics")).toBeVisible();
  await expect(page.locator("#hub-transports")).toBeVisible();
  await expect(page.locator("#hub-activities-plan")).toBeVisible();
  await testInfo.attach("full-trip", { body: Buffer.from(JSON.stringify({ tripId, tripName, serverResponses }, null, 2)), contentType: "application/json" });
  await assertDiagnostics();
});
