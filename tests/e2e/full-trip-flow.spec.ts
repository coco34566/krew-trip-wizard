import { expect, test } from "@playwright/test";
import { installDiagnostics, signIn } from "./helpers";

async function fillPreferences(page: any) {
  await page.getByRole("button", { name: "🧖 Détente", exact: true }).click();
  await page.getByRole("button", { name: "🏛️ Musées & culture", exact: true }).click();
  await page.getByRole("button", { name: "🏢 Centre-ville / urbain", exact: true }).click();
  await page.locator("#departure").fill("Paris");
  const cityChoice = page.getByRole("button", { name: /Paris France/ }).first();
  if (await cityChoice.isVisible().catch(() => false)) await cityChoice.click();
  await page.getByRole("button", { name: /Envoyer mes réponses/ }).click();
}

async function fillAvailability(page: any, tripId: string) {
  await page.goto(`/trips/${tripId}/availability`);
  await page.getByRole("button", { name: /Tous les week-ends affichés/ }).click();
  const saveAvailability = page.getByRole("button", { name: /Enregistrer mes disponibilités/ });
  await expect(saveAvailability).toBeEnabled();
  await saveAvailability.click();
  await page.waitForURL(new RegExp(`/trips/${tripId}/?$`), { timeout: 30_000 });
}

test("single full KREW journey from zero to planning", async ({ page, browser }, testInfo) => {
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

  stage = "organizer-availability";
  await fillAvailability(page, tripId!);

  stage = "organizer-preferences";
  await page.goto(`/trips/${tripId}/questionnaire`);
  await fillPreferences(page);
  await page.waitForURL(new RegExp(`/trips/${tripId}/?$`), { timeout: 30_000 });

  // Complete the real group path with a second authenticated QA participant.
  // First try to sign in to a fixed reusable QA account. If it does not exist yet,
  // create it through KREW's normal signup UI using the same Actions-only test password.
  stage = "second-participant-auth";
  const password = process.env.KREW_E2E_PASSWORD;
  if (!password) throw new Error("KREW_E2E_PASSWORD is required for the second QA participant");
  const participantEmail = "krew.qa.participant@gmail.com";
  const participantContext = await browser.newContext({
    ...testInfo.project.use,
    baseURL: process.env.KREW_E2E_BASE_URL,
  } as any);
  const participantPage = await participantContext.newPage();

  await participantPage.goto(`/auth?next=${encodeURIComponent(`/join/${tripId}`)}`);
  await participantPage.locator("#email").fill(participantEmail);
  await participantPage.locator("#password").fill(password);
  await participantPage.getByRole("button", { name: "Se connecter", exact: true }).click();

  const reachedJoin = await participantPage
    .waitForURL(new RegExp(`/join/${tripId}`), { timeout: 8_000 })
    .then(() => true)
    .catch(() => false);

  if (!reachedJoin) {
    await participantPage.goto(`/auth?next=${encodeURIComponent(`/join/${tripId}`)}`);
    await participantPage.getByRole("tab", { name: "Créer un compte", exact: true }).click();
    await participantPage.locator("#name").fill("QA Participant");
    await participantPage.locator("#email2").fill(participantEmail);
    await participantPage.locator("#password2").fill(password);
    await participantPage.getByRole("button", { name: "Créer mon compte", exact: true }).click();
    const confirmationRequired = await participantPage
      .getByText("Vérifie ta boîte mail pour confirmer ton adresse e-mail.", { exact: true })
      .isVisible()
      .catch(() => false);
    if (confirmationRequired) {
      throw new Error(
        "SECOND_QA_EMAIL_CONFIRMATION_REQUIRED: pre-create/confirm krew.qa.participant@gmail.com once, then rerun. No provider API was reached.",
      );
    }
    await participantPage.waitForURL(new RegExp(`/join/${tripId}`), { timeout: 30_000 });
  }

  stage = "second-participant-join";
  await participantPage.locator("#join-firstname").fill("QA2");
  await participantPage.getByRole("button", { name: "Rejoindre et indiquer mes dispos", exact: true }).click();
  await participantPage.waitForURL(new RegExp(`/trips/${tripId}/availability`), { timeout: 30_000 });

  stage = "second-participant-availability";
  await fillAvailability(participantPage, tripId!);

  stage = "second-participant-preferences";
  await participantPage.goto(`/trips/${tripId}/questionnaire`);
  await fillPreferences(participantPage);
  await participantPage.waitForURL(new RegExp(`/trips/${tripId}/?$`), { timeout: 30_000 });
  await participantContext.close();

  // Refresh organizer state now that both participants have answered.
  await page.goto(`/trips/${tripId}`);

  stage = "lock-dates";
  const dates = page.locator("#hub-dates");
  await expect(dates).toBeVisible();
  const proposedDateButton = dates.getByRole("button", { name: "Valider ces dates", exact: true }).first();
  if (await proposedDateButton.isVisible().catch(() => false)) {
    await proposedDateButton.click();
  } else {
    await dates.getByRole("button", { name: "Choisir d’autres dates", exact: true }).click();
    const manualStart = page.locator("#manual-start-date");
    await expect(manualStart).toBeVisible();
    const dateValue = await page.evaluate(() => {
      const d = new Date();
      d.setDate(d.getDate() + 21);
      return d.toISOString().slice(0, 10);
    });
    await manualStart.fill(dateValue);
    const dialog = page.getByRole("dialog");
    const manualValidate = dialog.getByRole("button", { name: "Valider ces dates", exact: true });
    await expect(manualValidate).toBeEnabled();
    await manualValidate.click();
  }
  await expect(dates.getByText("Dates validées", { exact: true })).toBeVisible({ timeout: 30_000 });

  stage = "stay-profile";
  const profile = page.locator("#hub-profile");
  await expect(profile).toBeVisible();
  const validateProfile = profile.getByRole("button", { name: "Valider notre profil de voyage", exact: true });
  await expect(validateProfile).toBeVisible({ timeout: 30_000 });
  await expect(validateProfile).toBeEnabled();
  await validateProfile.click();
  await expect(profile.getByText(/Profil validé/).first()).toBeVisible({ timeout: 30_000 });

  stage = "destinations";
  const destinations = page.locator("#hub-destination");
  await expect(destinations).toBeVisible();
  const generateDestinations = destinations.getByRole("button", { name: "Générer les propositions", exact: true });
  await expect(generateDestinations).toBeEnabled({ timeout: 20_000 });
  await generateDestinations.click();
  const selectDestination = destinations.getByRole("button", { name: "Choisir cette destination", exact: true }).first();
  await expect(selectDestination, "Destination generation must return a selectable proposal").toBeVisible({ timeout: 120_000 });
  await selectDestination.click();
  await expect(destinations.getByText(/Destination validée/).first()).toBeVisible({ timeout: 30_000 });

  stage = "accommodation";
  const accommodation = page.locator("#hub-logistics");
  await expect(accommodation).toBeVisible({ timeout: 30_000 });
  const accommodationButton = accommodation.getByRole("button", { name: "Rechercher des hébergements", exact: true });
  await expect(accommodationButton).toBeVisible();
  await accommodationButton.click();
  const hotelVote = accommodation.getByRole("button", { name: /^Voter ·/ }).first();
  await expect(hotelVote, "Accommodation search must return at least one hotel to vote on").toBeVisible({ timeout: 120_000 });
  await hotelVote.click();
  await expect(accommodation.getByRole("button", { name: /^Mon vote ·/ }).first()).toBeVisible({ timeout: 30_000 });

  stage = "transport";
  const transports = page.locator("#hub-transports");
  const transportButton = transports.getByRole("button", { name: "Générer des propositions", exact: true });
  await expect(transportButton).toBeEnabled();
  await transportButton.click();
  const chooseTransport = transports.getByRole("button", { name: "Choisir ce trajet", exact: true }).first();
  await expect(chooseTransport, "Transport generation must return at least one selectable route").toBeVisible({ timeout: 120_000 });
  await chooseTransport.click();
  await expect(transports.getByRole("button", { name: "Mon trajet", exact: true }).first()).toBeVisible({ timeout: 30_000 });

  stage = "planning";
  const planning = page.locator("#hub-activities-plan");
  const planningButton = planning.getByRole("button", { name: "Générer le planning", exact: true });
  await expect(planningButton).toBeVisible();
  await planningButton.click();
  await expect(planning.getByRole("heading", { name: /Jour 1/ }).first()).toBeVisible({ timeout: 120_000 });

  stage = "persistence";
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/trips/${tripId}/?$`));
  await expect(page.locator("#hub-destination").getByText(/Destination validée/).first()).toBeVisible();
  await expect(page.locator("#hub-logistics").getByRole("button", { name: /^Mon vote ·/ }).first()).toBeVisible();
  await expect(page.locator("#hub-transports").getByRole("button", { name: "Mon trajet", exact: true }).first()).toBeVisible();
  await expect(page.locator("#hub-activities-plan").getByRole("heading", { name: /Jour 1/ }).first()).toBeVisible();
  await testInfo.attach("full-trip", { body: Buffer.from(JSON.stringify({ tripId, tripName, serverResponses }, null, 2)), contentType: "application/json" });
  await assertDiagnostics();
});
