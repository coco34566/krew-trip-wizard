import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

export const qa = {
  email: (process.env.KREW_E2E_EMAIL ?? "").trim(),
  password: (process.env.KREW_E2E_PASSWORD ?? "").trim(),
  existingTripId: (process.env.KREW_E2E_EXISTING_TRIP_ID ?? "").trim(),
};

export function requireQaCredentials() {
  expect(qa.email, "KREW_E2E_EMAIL must be configured").not.toBe("");
  expect(qa.password, "KREW_E2E_PASSWORD must be configured").not.toBe("");
}

export async function handleNormalUserUi(page: Page) {
  const reject = page.getByRole("button", { name: /^Tout refuser$/i }).first();
  const accept = page.getByRole("button", { name: /^Tout accepter$/i }).first();
  if (await reject.isVisible().catch(() => false)) {
    await reject.click();
    await expect(reject).toBeHidden({ timeout: 5_000 });
    return;
  }
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
    await expect(accept).toBeHidden({ timeout: 5_000 });
  }
}

export async function userClick(page: Page, locator: Locator, label: string) {
  await handleNormalUserUi(page);
  await expect(locator, `USER_BLOCKER: ${label} is not visible`).toBeVisible();
  await expect(locator, `USER_BLOCKER: ${label} is disabled`).toBeEnabled();
  try {
    await locator.click({ timeout: 10_000 });
  } catch (error) {
    throw new Error(`USER_BLOCKER: ${label} cannot be clicked by a normal user :: ${String(error)}`);
  }
}

async function submitQaSignIn(page: Page, attempt: number) {
  await handleNormalUserUi(page);
  await page.getByRole("tab", { name: "Connexion" }).click();

  const email = page.locator("#email");
  const password = page.locator("#password");
  await expect(email).toBeVisible({ timeout: 10_000 });
  await email.fill(qa.email);
  await password.fill(qa.password);

  await userClick(
    page,
    page.getByRole("button", { name: "Se connecter", exact: true }),
    attempt === 0 ? "sign in" : "sign in retry",
  );

  const reachedDashboard = await page
    .waitForURL(/\/dashboard(?:\?|$)/, { timeout: attempt === 0 ? 15_000 : 30_000 })
    .then(() => true)
    .catch(() => false);
  if (reachedDashboard) return true;

  // If the app stayed on /auth, first distinguish a genuine credential problem from
  // the transient auth-page reset observed in WebKit/Vercel preview runs.
  await handleNormalUserUi(page);
  if (/\/dashboard(?:\?|$)/.test(new URL(page.url()).pathname)) return true;

  const explicitAuthError = page.getByText(
    /Identifiants incorrects|adresse e-mail n'a pas encore été confirmée|Impossible de se connecter/i,
  ).last();
  if (await explicitAuthError.isVisible().catch(() => false)) {
    const message = (await explicitAuthError.textContent().catch(() => null))?.trim() || "authentication rejected";
    throw new Error(`TEST_SETUP: QA authentication failed explicitly :: ${message}`);
  }

  const stillOnAuth = /\/auth(?:\?|$)/.test(new URL(page.url()).pathname);
  const emailValue = stillOnAuth && await email.isVisible().catch(() => false)
    ? await email.inputValue().catch(() => "")
    : "";
  const passwordValue = stillOnAuth && await password.isVisible().catch(() => false)
    ? await password.inputValue().catch(() => "")
    : "";

  // A complete remount can clear both fields and re-show cookie consent even though the
  // submitted credentials were valid. Retry exactly once from a clean UI state.
  if (attempt === 0 && stillOnAuth && !emailValue && !passwordValue) return false;

  throw new Error(
    `TEST_SETUP: QA sign-in did not reach dashboard after ${attempt + 1} attempt(s) (url=${page.url()})`,
  );
}

export async function signIn(page: Page) {
  requireQaCredentials();
  await page.goto("/auth");

  const firstAttemptSucceeded = await submitQaSignIn(page, 0);
  if (firstAttemptSucceeded) return;

  // Only retry the known transient remount case; never retry an explicit auth error.
  await page.goto("/auth");
  const retrySucceeded = await submitQaSignIn(page, 1);
  expect(retrySucceeded, "QA sign-in retry must reach dashboard").toBe(true);
}

function isExpectedAbortedNavigation(url: string, errorText: string) {
  if (!/(?:ERR_ABORTED|Load request cancelled)/i.test(errorText)) return false;
  if (/vercel\.live\/login\/validate/i.test(url)) return true;
  if (/\/\.well-known\/vercel\/jwe(?:\?|$)/i.test(url)) return true;
  if (/\/_serverFn\//i.test(url)) return true;
  if (/\/auth(?:\?|$)|\/dashboard(?:\?|$)|\/trips\//i.test(url)) return true;
  if (/\/assets\//i.test(url)) return true;
  if (/\/brand\/[^?#]+\.(?:png|jpe?g|webp|svg)(?:\?|$)/i.test(url)) return true;
  if (/\/krew-logo\.jpg(?:\?|$)/i.test(url)) return true;
  if (/supabase\.co\/auth\/v1\/user/i.test(url)) return true;
  return false;
}

export function installDiagnostics(page: Page, testInfo: TestInfo) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const ignoredAbortedRequests: string[] = [];
  const paidProviderRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "failed";
    const entry = `${request.method()} ${request.url()} :: ${errorText}`;
    if (isExpectedAbortedNavigation(request.url(), errorText)) {
      ignoredAbortedRequests.push(entry);
      return;
    }
    failedRequests.push(entry);
  });
  page.on("request", (request) => {
    const url = request.url().toLowerCase();
    if (/rapidapi|stayapi|searchapi|serper|tavily|gemini|geoapify|getyourguide|kiwi|kayak/.test(url)) {
      paidProviderRequests.push(request.url());
    }
  });

  return async () => {
    await testInfo.attach("browser-diagnostics", {
      body: Buffer.from(
        JSON.stringify({ consoleErrors, failedRequests, ignoredAbortedRequests, paidProviderRequests }, null, 2),
      ),
      contentType: "application/json",
    });
    expect(consoleErrors, "No browser console errors expected").toEqual([]);
    expect(failedRequests, "No unexpected failed browser requests expected").toEqual([]);
    expect(paidProviderRequests, "No hidden legacy paid-provider browser calls expected").toEqual([]);
  };
}

export async function openTrip(page: Page, tripId: string) {
  const normalizedTripId = tripId.trim();
  await page.goto(`/trips/${normalizedTripId}`);
  await expect(page).toHaveURL(new RegExp(`/trips/${normalizedTripId}`));
  await expect(page.locator("main")).toBeVisible();
}