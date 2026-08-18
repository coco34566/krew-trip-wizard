import { expect, type Page, type TestInfo } from "@playwright/test";

export const qa = {
  email: process.env.KREW_E2E_EMAIL ?? "",
  password: process.env.KREW_E2E_PASSWORD ?? "",
  existingTripId: process.env.KREW_E2E_EXISTING_TRIP_ID ?? "",
};

export function requireQaCredentials() {
  expect(qa.email, "KREW_E2E_EMAIL must be configured").not.toBe("");
  expect(qa.password, "KREW_E2E_PASSWORD must be configured").not.toBe("");
}

async function dismissCookieBanner(page: Page) {
  const reject = page.getByRole("button", { name: /tout refuser|refuser/i }).first();
  const accept = page.getByRole("button", { name: /tout accepter|accepter/i }).first();

  if (await reject.isVisible().catch(() => false)) {
    await reject.click();
    return;
  }
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
  }
}

export async function signIn(page: Page) {
  requireQaCredentials();
  await page.goto("/auth");
  await dismissCookieBanner(page);
  await page.getByRole("tab", { name: "Connexion" }).click();
  await page.locator("#email").fill(qa.email);
  await page.locator("#password").fill(qa.password);
  await Promise.all([
    page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Se connecter" }).click(),
  ]);
}

function isExpectedAbortedNavigation(url: string, errorText: string) {
  if (!/(?:ERR_ABORTED|Load request cancelled)/i.test(errorText)) return false;
  if (/\/\.well-known\/vercel\/jwe(?:\?|$)/i.test(url)) return true;
  if (/\/auth(?:\?|$)|\/dashboard(?:\?|$)|\/trips\//i.test(url)) return true;
  if (/\/assets\//i.test(url)) return true;
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
    if (/rapidapi|stayapi|serper|kiwi|kayak/.test(url)) paidProviderRequests.push(request.url());
  });

  return async () => {
    await testInfo.attach("browser-diagnostics", {
      body: Buffer.from(
        JSON.stringify(
          { consoleErrors, failedRequests, ignoredAbortedRequests, paidProviderRequests },
          null,
          2,
        ),
      ),
      contentType: "application/json",
    });
    expect(consoleErrors, "No browser console errors expected").toEqual([]);
    expect(failedRequests, "No unexpected failed browser requests expected").toEqual([]);
    expect(paidProviderRequests, "No hidden legacy paid-provider browser calls expected").toEqual([]);
  };
}

export async function openTrip(page: Page, tripId: string) {
  await page.goto(`/trips/${tripId}`);
  await expect(page).toHaveURL(new RegExp(`/trips/${tripId}`));
  await expect(page.locator("main")).toBeVisible();
}
