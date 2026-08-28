import { expect, test, type Page } from "@playwright/test";
import { installDiagnostics, signIn, userClick, handleNormalUserUi } from "./helpers";

async function fillPreferences(page: Page) {
  await userClick(page, page.getByRole("button", { name: "🧖 Détente", exact: true }), "choose Détente");
  await userClick(page, page.getByRole("button", { name: "🏛️ Musées & culture", exact: true }), "choose culture");
  await userClick(page, page.getByRole("button", { name: "🏢 Centre-ville / urbain", exact: true }), "choose urban");
  await page.locator("#departure").fill("Paris");
  const cityChoice = page.getByRole("button", { name: /Paris France/ }).first();
  if (await cityChoice.isVisible().catch(() => false)) await userClick(page, cityChoice, "choose Paris autocomplete");
  await userClick(page, page.getByRole("button", { name: /Envoyer mes réponses/ }), "submit preferences");
}

async function waitForTripHub(page: Page, tripId: string) {
  await page.waitForURL(
    (url) => url.pathname === `/trips/${tripId}`,
    { timeout: 30_000 },
  );
  // TanStack can still be completing the SPA transition after the URL itself changes.
  // Waiting for network idle prevents the next explicit goto from racing that transition.
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
}

async function fillAvailability(page: Page, tripId: string) {
  await page.goto(`/trips/${tripId}/availability`);
  await handleNormalUserUi(page);
  await userClick(page, page.getByRole("button", { name: /Tous les week-ends affichés/ }), "select all displayed weekends");
  const saveAvailability = page.getByRole("button", { name: /Enregistrer mes disponibilités/ });
  await expect(saveAvailability).toBeEnabled();
  await userClick(page, saveAvailability, "save availability");
  await waitForTripHub(page, tripId);
}

async function authenticateSecondParticipant(page: Page, tripId: string, email: string, password: string) {
  const authUrl = `/auth?next=${encodeURIComponent(`/join/${tripId}`)}`;
  const joinUrl = new RegExp(`/join/${tripId}(?:\\?|$)`);

  await page.goto(authUrl);
  await handleNormalUserUi(page);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await userClick(page, page.getByRole("button", { name: "Se connecter", exact: true }), "second participant sign in");

  const invalidCredentials = page.getByText(
    "Identifiants incorrects. Vérifie ton adresse e-mail et ton mot de passe.",
    { exact: true },
  );

  const signInOutcome = await Promise.race([
    page.waitForURL(joinUrl, { timeout: 30_000 }).then(() => "join" as const),
    invalidCredentials.waitFor({ state: "visible", timeout: 30_000 }).then(() => "invalid" as const),
  ]).catch(() => "timeout" as const);

  if (signInOutcome === "join") return;
  if (signInOutcome === "timeout") {
    throw new Error(
      `TEST_SETUP: second participant authentication neither reached /join/${tripId} nor returned an explicit credentials error within 30s`,
    );
  }

  // Only a real credentials error may trigger first-time QA account creation.
  // A slow redirect must never be interpreted as “account does not exist”.
  await page.goto(authUrl);
  await handleNormalUserUi(page);
  await userClick(page, page.getByRole("tab", { name: "Créer un compte", exact: true }), "open signup");
  await page.locator("#name").fill("QA Participant");
  await page.locator("#email2").fill(email);
  await page.locator("#password2").fill(password);
  await userClick(page, page.getByRole("button", { name: "Créer mon compte", exact: true }), "create second QA account");

  const confirmationRequired = page.getByText(
    "Vérifie ta boîte mail pour confirmer ton adresse e-mail.",
    { exact: true },
  );
  const alreadyRegistered = page.getByText(
    "Cette adresse e-mail est déjà utilisée pour un autre compte.",
    { exact: true },
  );

  const signUpOutcome = await Promise.race([
    page.waitForURL(joinUrl, { timeout: 30_000 }).then(() => "join" as const),
    confirmationRequired.waitFor({ state: "visible", timeout: 30_000 }).then(() => "confirmation" as const),
    alreadyRegistered.waitFor({ state: "visible", timeout: 30_000 }).then(() => "registered" as const),
  ]).catch(() => "timeout" as const);

  if (signUpOutcome === "join") return;
  if (signUpOutcome === "confirmation") {
    throw new Error("TEST_SETUP: second QA account requires one-time email confirmation; no provider API reached");
  }
  if (signUpOutcome === "registered") {
    throw new Error("TEST_SETUP: second QA account exists but KREW_E2E_PASSWORD does not authenticate it");
  }
  throw new Error(`TEST_SETUP: second QA account creation did not reach /join/${tripId} within 30s`);
}

test("single full KREW journey from zero to planning", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-safari", "Full provider-consuming journey runs once only.");
  const apiMode = process.env.KREW_E2E_API_MODE ?? "safe";
  if (!["safe", "real"].includes(apiMode)) {
    throw new Error(`TEST_SETUP: unsupported KREW_E2E_API_MODE=${apiMode}`);
  }
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
  await handleNormalUserUi(page);
  const tripName = `E2E-FULL-${Date.now()}`;
  await page.locator("#name").fill(tripName);
  await page.locator("#orga").fill("QA");
  await userClick(page, page.getByRole("button", { name: /25-35 ans/ }), "choose age range");
  await page.locator("#n").fill("2");
  await page.locator("#durationDays").fill("3");
  await Promise.all([
    page.waitForURL(/\/trips\/[^/]+\/invite/, { timeout: 30_000 }),
    userClick(page, page.getByRole("button", { name: /Créer et inviter le groupe/ }), "create trip"),
  ]);
  const tripId = page.url().match(/\/trips\/([^/]+)\/invite/)?.[1];
  expect(tripId).toBeTruthy();

  stage = "organizer-availability";
  await fillAvailability(page, tripId!);

  stage = "organizer-preferences";
  await page.goto(`/trips/${tripId}/questionnaire`);
  await handleNormalUserUi(page);
  await fillPreferences(page);
  await waitForTripHub(page, tripId!);

  stage = "second-participant-auth";
  const password = process.env.KREW_E2E_PASSWORD;
  if (!password) throw new Error("TEST_SETUP: KREW_E2E_PASSWORD is required");
  const participantEmail = "krew.qa.participant@gmail.com";
  const participantContext = await browser.newContext({ ...testInfo.project.use, baseURL: process.env.KREW_E2E_BASE_URL } as any);
  const participantPage = await participantContext.newPage();
  await authenticateSecondParticipant(participantPage, tripId!, participantEmail, password);

  stage = "second-participant-join";
  await handleNormalUserUi(participantPage);
  await participantPage.locator("#join-firstname").fill("QA2");
  await userClick(participantPage, participantPage.getByRole("button", { name: "Rejoindre et indiquer mes dispos", exact: true }), "join trip");
  await participantPage.waitForURL(new RegExp(`/trips/${tripId}/availability`), { timeout: 30_000 });

  stage = "second-participant-availability";
  await fillAvailability(participantPage, tripId!);
  stage = "second-participant-preferences";
  await participantPage.goto(`/trips/${tripId}/questionnaire`);
  await handleNormalUserUi(participantPage);
  await fillPreferences(participantPage);
  await waitForTripHub(participantPage, tripId!);
  await participantContext.close();

  await page.goto(`/trips/${tripId}?view=voyage&section=dates`);
  await handleNormalUserUi(page);

  stage = "lock-dates";
  const dates = page.locator("#hub-dates");
  await expect(dates).toBeVisible();
  const proposedDateButton = dates.getByRole("button", { name: "Valider ces dates", exact: true }).first();
  if (await proposedDateButton.isVisible().catch(() => false)) {
    await userClick(page, proposedDateButton, "validate proposed dates");
  } else {
    await userClick(page, dates.getByRole("button", { name: "Choisir d’autres dates", exact: true }), "open organizer date override");
    const manualStart = page.locator("#manual-start-date");
    await expect(manualStart).toBeVisible();
    const dateValue = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 21); return d.toISOString().slice(0, 10); });
    await manualStart.fill(dateValue);
    const manualValidate = page.getByRole("dialog").getByRole("button", { name: "Valider ces dates", exact: true });
    await expect(manualValidate).toBeEnabled();
    await userClick(page, manualValidate, "validate organizer dates");
  }
  await expect(dates.getByText("Dates validées", { exact: true })).toBeVisible({ timeout: 30_000 });

  stage = "stay-profile";
  await page.goto(`/trips/${tripId}?view=voyage&section=profile`);
  await handleNormalUserUi(page);
  const profile = page.locator("#hub-profile");
  const validateProfile = profile.getByRole("button", { name: "Valider notre profil de voyage", exact: true });
  await expect(validateProfile).toBeEnabled({ timeout: 30_000 });
  await userClick(page, validateProfile, "validate stay profile");
  await expect(profile.getByText(/Profil validé/).first()).toBeVisible({ timeout: 30_000 });

  if (apiMode === "safe") {
    stage = "safe-mode-complete";
    await page.reload();
    await handleNormalUserUi(page);
    await expect(page.locator("#hub-profile").getByText(/Profil validé/).first()).toBeVisible();

    await page.goto(`/trips/${tripId}?view=voyage&section=dates`);
    await handleNormalUserUi(page);
    await expect(page.locator("#hub-dates").getByText("Dates validées", { exact: true })).toBeVisible();

    // Le parcours sécurisé s'arrête exactement avant le premier appel fournisseur.
    // On vérifie néanmoins que l'étape suivante est réellement accessible à l'organisateur.
    await page.goto(`/trips/${tripId}?view=voyage&section=destination`);
    await handleNormalUserUi(page);
    const safeDestinationCta = page
      .locator("#hub-destination")
      .getByRole("button", { name: "Générer les propositions", exact: true });
    await expect(safeDestinationCta).toBeVisible();
    await expect(safeDestinationCta).toBeEnabled();

    // Vérifie que le voyage créé reste retrouvable depuis la liste, puis après une nouvelle navigation.
    stage = "safe-dashboard-persistence";
    await page.goto("/dashboard");
    await handleNormalUserUi(page);
    await expect(page.getByText(tripName, { exact: false }).first()).toBeVisible();
    await page.goto(`/trips/${tripId}?view=voyage&section=profile`);
    await handleNormalUserUi(page);
    await expect(page.locator("#hub-profile").getByText(/Profil validé/).first()).toBeVisible();

    await page.goto(`/trips/${tripId}?view=voyage&section=dates`);
    await handleNormalUserUi(page);
    await expect(page.locator("#hub-dates").getByText("Dates validées", { exact: true })).toBeVisible();

    await testInfo.attach("safe-trip", { body: Buffer.from(JSON.stringify({ tripId, tripName, apiMode, serverResponses }, null, 2)), contentType: "application/json" });
    await assertDiagnostics();
    return;
  }

  testInfo.annotations.push({ type: "warning", description: "LIVE API MODE: destination, accommodation, transport and planning may consume provider quota." });

  stage = "destinations";
  await page.goto(`/trips/${tripId}?view=voyage&section=destination`);
  await handleNormalUserUi(page);
  const destinations = page.locator("#hub-destination");
  const generateDestinations = destinations.getByRole("button", { name: "Générer les propositions", exact: true });
  await expect(generateDestinations).toBeEnabled({ timeout: 20_000 });
  await userClick(page, generateDestinations, "generate destinations");
  const selectDestination = destinations.getByRole("button", { name: "Choisir cette destination", exact: true }).first();
  await expect(selectDestination, "USER_BLOCKER: destination generation returned no selectable proposal").toBeVisible({ timeout: 120_000 });
  await userClick(page, selectDestination, "choose destination");
  await expect(destinations.getByText(/Destination validée/).first()).toBeVisible({ timeout: 30_000 });

  stage = "accommodation";
  await page.goto(`/trips/${tripId}?view=voyage&section=accommodation`);
  await handleNormalUserUi(page);
  const accommodation = page.locator("#hub-logistics");
  const accommodationButton = accommodation.getByRole("button", { name: "Rechercher des hébergements", exact: true });
  await userClick(page, accommodationButton, "search accommodation");
  const hotelVote = accommodation.getByRole("button", { name: /^Voter ·/ }).first();
  await expect(hotelVote, "USER_BLOCKER: accommodation search returned no usable hotel").toBeVisible({ timeout: 120_000 });
  await userClick(page, hotelVote, "vote hotel");

  stage = "transport";
  await page.goto(`/trips/${tripId}?view=voyage&section=transport`);
  await handleNormalUserUi(page);
  const transports = page.locator("#hub-transports");
  const transportButton = transports.getByRole("button", { name: "Trouver les trajets", exact: true });
  await expect(transportButton).toBeEnabled();
  await userClick(page, transportButton, "generate transport");
  const chooseTransport = transports.getByRole("button", { name: "Choisir ce trajet", exact: true }).first();
  await expect(chooseTransport, "USER_BLOCKER: transport generation returned no selectable route").toBeVisible({ timeout: 120_000 });
  await userClick(page, chooseTransport, "choose transport");

  stage = "planning";
  await page.goto(`/trips/${tripId}?view=voyage&section=planning`);
  await handleNormalUserUi(page);
  const planning = page.locator("#hub-activities-plan");
  const planningButton = planning.getByRole("button", { name: "Préparer le planning", exact: true });
  await userClick(page, planningButton, "generate planning");
  await expect(planning.getByRole("heading", { name: /Jour 1/ }).first(), "USER_BLOCKER: planning returned no Day 1").toBeVisible({ timeout: 120_000 });

  stage = "persistence";
  await page.reload();
  await handleNormalUserUi(page);
  await expect(page.locator("#hub-activities-plan").getByRole("heading", { name: /Jour 1/ }).first()).toBeVisible();

  await page.goto(`/trips/${tripId}?view=voyage&section=destination`);
  await handleNormalUserUi(page);
  await expect(page.locator("#hub-destination").getByText(/Destination validée/).first()).toBeVisible();
  await page.goto(`/trips/${tripId}?view=voyage&section=accommodation`);
  await handleNormalUserUi(page);
  await expect(page.locator("#hub-logistics").getByRole("button", { name: /^Mon vote ·/ }).first()).toBeVisible();
  await page.goto(`/trips/${tripId}?view=voyage&section=transport`);
  await handleNormalUserUi(page);
  await expect(page.locator("#hub-transports").getByRole("button", { name: "Mon trajet", exact: true }).first()).toBeVisible();
  await testInfo.attach("full-trip", { body: Buffer.from(JSON.stringify({ tripId, tripName, serverResponses }, null, 2)), contentType: "application/json" });
  await assertDiagnostics();
});
