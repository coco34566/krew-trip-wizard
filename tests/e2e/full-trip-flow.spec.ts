import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { installDiagnostics, signIn, userClick, handleNormalUserUi } from "./helpers";
import { deleteDisposableTrip, disposableTripName } from "./test-lifecycle";

type JourneyProfile = {
  kind: "standard" | "complex";
  groupSize: number;
  durationDays: number;
  organizer: "city" | "outdoor";
  participant: "city" | "outdoor";
};

const STANDARD: JourneyProfile = {
  kind: "standard",
  groupSize: 2,
  durationDays: 3,
  organizer: "city",
  participant: "city",
};

const COMPLEX: JourneyProfile = {
  kind: "complex",
  groupSize: 6,
  durationDays: 4,
  organizer: "city",
  participant: "outdoor",
};

async function fillPreferences(page: Page, profile: "city" | "outdoor") {
  if (profile === "outdoor") {
    await userClick(page, page.getByRole("button", { name: "🏄 Sportif", exact: true }), "choose Sportif");
    await userClick(page, page.getByRole("button", { name: "⚽ Sport & outdoor", exact: true }), "choose outdoor activities");
    await userClick(page, page.getByRole("button", { name: "🌳 Nature / pleine nature", exact: true }), "choose nature environment");
    await page.locator("#departure").fill("Lyon");
    const cityChoice = page.getByRole("button", { name: /Lyon France/ }).first();
    if (await cityChoice.isVisible().catch(() => false)) await userClick(page, cityChoice, "choose Lyon autocomplete");
  } else {
    await userClick(page, page.getByRole("button", { name: "🧖 Détente", exact: true }), "choose Détente");
    await userClick(page, page.getByRole("button", { name: "🏛️ Musées & culture", exact: true }), "choose culture");
    await userClick(page, page.getByRole("button", { name: "🏢 Centre-ville / urbain", exact: true }), "choose urban");
    await page.locator("#departure").fill("Paris");
    const cityChoice = page.getByRole("button", { name: /Paris France/ }).first();
    if (await cityChoice.isVisible().catch(() => false)) await userClick(page, cityChoice, "choose Paris autocomplete");
  }
  await userClick(page, page.getByRole("button", { name: /Envoyer mes réponses/ }), "submit preferences");
}

async function waitForTripHub(page: Page, tripId: string) {
  await page.waitForURL((url) => url.pathname === `/trips/${tripId}`, { timeout: 30_000 });
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
  const outcome = await Promise.race([
    page.waitForURL(joinUrl, { timeout: 30_000 }).then(() => "join" as const),
    invalidCredentials.waitFor({ state: "visible", timeout: 30_000 }).then(() => "invalid" as const),
  ]).catch(() => "timeout" as const);

  if (outcome === "join") return;
  if (outcome === "timeout") throw new Error(`TEST_SETUP: second participant authentication did not reach /join/${tripId}`);

  await page.goto(authUrl);
  await handleNormalUserUi(page);
  await userClick(page, page.getByRole("tab", { name: "Créer un compte", exact: true }), "open signup");
  await page.locator("#name").fill("QA Participant");
  await page.locator("#email2").fill(email);
  await page.locator("#password2").fill(password);
  await userClick(page, page.getByRole("button", { name: "Créer mon compte", exact: true }), "create second QA account");

  const confirmationRequired = page.getByText("Vérifie ta boîte mail pour confirmer ton adresse e-mail.", { exact: true });
  const alreadyRegistered = page.getByText("Cette adresse e-mail est déjà utilisée pour un autre compte.", { exact: true });
  const signUpOutcome = await Promise.race([
    page.waitForURL(joinUrl, { timeout: 30_000 }).then(() => "join" as const),
    confirmationRequired.waitFor({ state: "visible", timeout: 30_000 }).then(() => "confirmation" as const),
    alreadyRegistered.waitFor({ state: "visible", timeout: 30_000 }).then(() => "registered" as const),
  ]).catch(() => "timeout" as const);

  if (signUpOutcome === "join") return;
  if (signUpOutcome === "confirmation") throw new Error("TEST_SETUP: second QA account requires one-time email confirmation");
  if (signUpOutcome === "registered") throw new Error("TEST_SETUP: second QA account exists but the configured password does not authenticate it");
  throw new Error(`TEST_SETUP: second QA account creation did not reach /join/${tripId}`);
}

async function runJourney(page: Page, browser: Browser, testInfo: TestInfo, profile: JourneyProfile) {
  test.skip(testInfo.project.name !== "mobile-safari", "Full provider-consuming journeys run once only.");
  const apiMode = process.env.KREW_E2E_API_MODE ?? "real";
  if (apiMode !== "real") throw new Error("TEST_SETUP: manual full journeys require KREW_E2E_API_MODE=real");

  const assertDiagnostics = installDiagnostics(page, testInfo);
  const serverResponses: Array<{ stage: string; url: string; status: number; body: string }> = [];
  let stage = "setup";
  let tripId: string | undefined;
  let tripName: string | undefined;

  page.on("response", async (response) => {
    if (!response.url().includes("/_serverFn/")) return;
    let body = "";
    try { body = (await response.text()).slice(0, 3000); } catch { body = "<unreadable>"; }
    serverResponses.push({ stage, url: response.url(), status: response.status(), body });
  });

  try {
    await signIn(page);

    stage = "create-trip";
    await page.goto("/trips/new");
    await handleNormalUserUi(page);
    tripName = disposableTripName("FULL");
    await page.locator("#name").fill(tripName);
    await page.locator("#orga").fill("QA");
    await userClick(page, page.getByRole("button", { name: /25-35 ans/ }), "choose age range");
    await page.locator("#n").fill(String(profile.groupSize));
    await page.locator("#durationDays").fill(String(profile.durationDays));
    await Promise.all([
      page.waitForURL(/\/trips\/[^/]+\/invite/, { timeout: 30_000 }),
      userClick(page, page.getByRole("button", { name: /Créer et inviter le groupe/ }), "create trip"),
    ]);
    tripId = page.url().match(/\/trips\/([^/]+)\/invite/)?.[1];
    expect(tripId).toBeTruthy();

    stage = "organizer-availability";
    await fillAvailability(page, tripId!);
    stage = "organizer-preferences";
    await page.goto(`/trips/${tripId}/questionnaire`);
    await handleNormalUserUi(page);
    await fillPreferences(page, profile.organizer);
    await waitForTripHub(page, tripId!);

    stage = "participant-auth";
    const password = process.env.KREW_E2E_PASSWORD;
    if (!password) throw new Error("TEST_SETUP: KREW_E2E_PASSWORD is required");
    const participantContext = await browser.newContext({ ...testInfo.project.use, baseURL: process.env.KREW_E2E_BASE_URL } as any);
    const participantPage = await participantContext.newPage();
    try {
      await authenticateSecondParticipant(participantPage, tripId!, "krew.qa.participant@gmail.com", password);
      stage = "participant-join";
      await handleNormalUserUi(participantPage);
      await participantPage.locator("#join-firstname").fill(profile.kind === "complex" ? "QA Outdoor" : "QA2");
      await userClick(participantPage, participantPage.getByRole("button", { name: "Rejoindre et indiquer mes dispos", exact: true }), "join trip");
      await participantPage.waitForURL(new RegExp(`/trips/${tripId}/availability`), { timeout: 30_000 });
      stage = "participant-availability";
      await fillAvailability(participantPage, tripId!);
      stage = "participant-preferences";
      await participantPage.goto(`/trips/${tripId}/questionnaire`);
      await handleNormalUserUi(participantPage);
      await fillPreferences(participantPage, profile.participant);
      await waitForTripHub(participantPage, tripId!);
    } finally {
      await participantContext.close();
    }

    stage = "lock-dates";
    await page.goto(`/trips/${tripId}?view=voyage&section=dates`);
    await handleNormalUserUi(page);
    const dates = page.locator("#hub-dates");
    await expect(dates).toBeVisible();
    const proposed = dates.getByRole("button", { name: "Valider ces dates", exact: true }).first();
    if (await proposed.isVisible().catch(() => false)) {
      await userClick(page, proposed, "validate proposed dates");
    } else {
      await userClick(page, dates.getByRole("button", { name: "Choisir d’autres dates", exact: true }), "open organizer date override");
      const manualStart = page.locator("#manual-start-date");
      await expect(manualStart).toBeVisible();
      const dateValue = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 21); return d.toISOString().slice(0, 10); });
      await manualStart.fill(dateValue);
      const validate = page.getByRole("dialog").getByRole("button", { name: "Valider ces dates", exact: true });
      await expect(validate).toBeEnabled();
      await userClick(page, validate, "validate organizer dates");
    }
    await expect(dates.getByText("Dates validées", { exact: true })).toBeVisible({ timeout: 30_000 });

    stage = "stay-profile";
    await page.goto(`/trips/${tripId}?view=voyage&section=profile`);
    await handleNormalUserUi(page);
    const stayProfile = page.locator("#hub-profile");
    const validateProfile = stayProfile.getByRole("button", { name: "Valider notre profil de voyage", exact: true });
    await expect(validateProfile).toBeEnabled({ timeout: 30_000 });
    await userClick(page, validateProfile, "validate stay profile");
    await expect(stayProfile.getByText(/Profil validé/).first()).toBeVisible({ timeout: 30_000 });

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
    await userClick(page, accommodation.getByRole("button", { name: "Rechercher des hébergements", exact: true }), "search accommodation");
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
    await userClick(page, planning.getByRole("button", { name: "Préparer le planning", exact: true }), "generate planning");
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

    await testInfo.attach("full-trip", {
      body: Buffer.from(JSON.stringify({ profile, tripId, tripName, serverResponses }, null, 2)),
      contentType: "application/json",
    });
    await assertDiagnostics();
  } finally {
    await deleteDisposableTrip(page, tripId, tripName, testInfo);
  }
}

test("@full-standard full KREW journey — standard group", async ({ page, browser }, testInfo) => {
  await runJourney(page, browser, testInfo, STANDARD);
});

test("@full-complex full KREW journey — mixed-preference group", async ({ page, browser }, testInfo) => {
  await runJourney(page, browser, testInfo, COMPLEX);
});
