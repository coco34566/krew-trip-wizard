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

export async function signIn(page: Page) {
  requireQaCredentials();
  await page.goto("/auth");
  await page.getByRole("tab", { name: "Connexion" }).click();
  await page.locator("#email").fill(qa.email);
  await page.locator("#password").fill(qa.password);
  await Promise.all([
    page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Se connecter" }).click(),
  ]);
}

export function installDiagnostics(page: Page, testInfo: TestInfo) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const paidProviderRequests: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "failed"}`);
  });
  page.on("request", (request) => {
    const url = request.url().toLowerCase();
    if (/rapidapi|stayapi|serper|kiwi|kayak/.test(url)) paidProviderRequests.push(request.url());
  });

  return async () => {
    await testInfo.attach("browser-diagnostics", {
      body: Buffer.from(JSON.stringify({ consoleErrors, failedRequests, paidProviderRequests }, null, 2)),
      contentType: "application/json",
    });
    expect(consoleErrors, "No browser console errors expected").toEqual([]);
    expect(failedRequests, "No failed browser requests expected").toEqual([]);
    expect(paidProviderRequests, "No hidden legacy paid-provider browser calls expected").toEqual([]);
  };
}

export async function openTrip(page: Page, tripId: string) {
  await page.goto(`/trips/${tripId}`);
  await expect(page).toHaveURL(new RegExp(`/trips/${tripId}`));
  await expect(page.locator("main")).toBeVisible();
}
