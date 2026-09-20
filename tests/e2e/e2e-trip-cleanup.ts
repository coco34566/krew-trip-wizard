import { chmod, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page, type Request } from "@playwright/test";
import { qa, signIn } from "./helpers";
import { belongsToCurrentE2ERun, ensureE2ERunToken, isTestTripName } from "./test-trip-constants";

type OwnedTrip = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
};

type SupabaseRestSession = {
  origin: string;
  apiKey: string;
  accessToken: string;
  userId: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const LEFTOVER_WARNING_THRESHOLD = 10;

function cleanupRunKey() {
  return (
    process.env.KREW_E2E_RUN_TOKEN ||
    [process.env.GITHUB_RUN_ID, process.env.GITHUB_RUN_ATTEMPT].filter(Boolean).join("-") ||
    "local"
  ).replace(/[^a-zA-Z0-9._-]/g, "_");
}

function cleanupSessionPath() {
  return join(tmpdir(), `krew-e2e-cleanup-session-${cleanupRunKey()}.json`);
}

function cleanupStartupMarkerPath() {
  return join(tmpdir(), `krew-e2e-cleanup-started-${cleanupRunKey()}.marker`);
}

function warn(message: string, error?: unknown) {
  console.warn(`[KREW E2E cleanup] ${message}`, error ?? "");
}

async function readBrowserSession(page: Page) {
  return page.evaluate(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const value = localStorage.getItem(key);
      if (!value) continue;
      try {
        const parsed = JSON.parse(value);
        const session = parsed?.access_token ? parsed : parsed?.currentSession;
        if (session?.access_token && session?.user?.id) {
          return { accessToken: session.access_token as string, userId: session.user.id as string };
        }
      } catch {
        // Ignore unrelated localStorage values.
      }
    }
    return null;
  });
}

async function captureSupabaseRequest(request: Request) {
  if (!/\.supabase\.co\//i.test(request.url())) return null;
  const headers = await request.allHeaders();
  const apiKey = headers.apikey;
  if (!apiKey) return null;
  return { origin: new URL(request.url()).origin, apiKey };
}

async function readCachedRestSession(): Promise<SupabaseRestSession | null> {
  try {
    const raw = await readFile(cleanupSessionPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<SupabaseRestSession>;
    if (
      typeof parsed.origin === "string" &&
      typeof parsed.apiKey === "string" &&
      typeof parsed.accessToken === "string" &&
      typeof parsed.userId === "string"
    ) {
      return parsed as SupabaseRestSession;
    }
  } catch {
    // First Playwright invocation in the run has no cached cleanup session yet.
  }
  return null;
}

async function cacheRestSession(session: SupabaseRestSession) {
  const path = cleanupSessionPath();
  await writeFile(path, JSON.stringify(session), "utf8");
  await chmod(path, 0o600).catch(() => undefined);
}

async function getAuthenticatedRestSession(): Promise<SupabaseRestSession | null> {
  const cached = await readCachedRestSession();
  if (cached) return cached;
  if (!qa.email || !qa.password) {
    warn("KREW_E2E_EMAIL/KREW_E2E_PASSWORD are not configured; cleanup skipped.");
    return null;
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: process.env.KREW_E2E_BASE_URL ?? "http://127.0.0.1:3000",
  });
  const page = await context.newPage();
  let captured: { origin: string; apiKey: string } | null = null;

  page.on("request", (request) => {
    if (captured) return;
    void captureSupabaseRequest(request).then((value) => {
      if (value && !captured) captured = value;
    });
  });

  try {
    await signIn(page);
    await page.waitForTimeout(250);
    if (!captured) {
      await page.goto("/dashboard");
      await page.waitForTimeout(750);
    }

    const browserSession = await readBrowserSession(page);
    if (!captured || !browserSession) {
      warn("Could not recover the authenticated Supabase REST session from the E2E browser session.");
      return null;
    }

    const session = {
      origin: captured.origin,
      apiKey: captured.apiKey,
      accessToken: browserSession.accessToken,
      userId: browserSession.userId,
    };
    await cacheRestSession(session);
    return session;
  } finally {
    await context.close();
    await browser.close();
  }
}

function restHeaders(session: SupabaseRestSession, extra?: Record<string, string>) {
  return {
    apikey: session.apiKey,
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function listOwnedTrips(session: SupabaseRestSession): Promise<OwnedTrip[]> {
  const url = new URL("/rest/v1/trips", session.origin);
  url.searchParams.set("select", "id,name,owner_id,created_at");
  url.searchParams.set("owner_id", `eq.${session.userId}`);
  url.searchParams.set("order", "created_at.asc");

  const response = await fetch(url, { headers: restHeaders(session) });
  if (!response.ok) throw new Error(`List owned trips failed (${response.status}): ${await response.text()}`);
  const trips = (await response.json()) as OwnedTrip[];

  // Defense in depth: never operate on rows that are not owned by the authenticated E2E user.
  return trips.filter((trip) => trip.owner_id === session.userId);
}

async function deleteOwnedTestTrip(session: SupabaseRestSession, trip: OwnedTrip) {
  if (trip.owner_id !== session.userId || !isTestTripName(trip.name)) return false;

  const url = new URL("/rest/v1/trips", session.origin);
  url.searchParams.set("id", `eq.${trip.id}`);
  url.searchParams.set("owner_id", `eq.${session.userId}`);
  url.searchParams.set("name", `eq.${trip.name}`);

  const response = await fetch(url, {
    method: "DELETE",
    headers: restHeaders(session, { Prefer: "return=representation" }),
  });

  if (!response.ok) {
    warn(`Failed to delete test trip ${trip.id} (${trip.name}) with status ${response.status}: ${await response.text()}`);
    return false;
  }

  const deleted = (await response.json()) as OwnedTrip[];
  if (deleted.length !== 1 || deleted[0]?.id !== trip.id || deleted[0]?.owner_id !== session.userId) {
    warn(`Delete verification was inconclusive for ${trip.id} (${trip.name}); returned ${deleted.length} row(s).`);
    return false;
  }
  return true;
}

async function deleteMatchingTrips(session: SupabaseRestSession, predicate: (trip: OwnedTrip) => boolean) {
  const trips = await listOwnedTrips(session);
  let deleted = 0;
  for (const trip of trips) {
    if (!isTestTripName(trip.name) || !predicate(trip)) continue;
    try {
      if (await deleteOwnedTestTrip(session, trip)) deleted += 1;
    } catch (error) {
      warn(`Unexpected error deleting ${trip.id} (${trip.name}); continuing cleanup.`, error);
    }
  }
  return deleted;
}

export async function runE2EStartupCleanup() {
  ensureE2ERunToken();

  try {
    await readFile(cleanupStartupMarkerPath(), "utf8");
    return;
  } catch {
    // First Playwright invocation in this run.
  }

  // Mark before authenticating so one transient cleanup failure cannot cause a new
  // Supabase Auth login on every separate `playwright test` command in the job.
  await writeFile(cleanupStartupMarkerPath(), new Date().toISOString(), "utf8").catch(() => undefined);

  try {
    const session = await getAuthenticatedRestSession();
    if (!session) return;

    const cutoff = Date.now() - DAY_MS;
    const deleted = await deleteMatchingTrips(session, (trip) => {
      const createdAt = Date.parse(trip.created_at);
      return Number.isFinite(createdAt) && createdAt < cutoff;
    });

    if (deleted > 0) warn(`Removed ${deleted} stale E2E test trip(s) older than 24h before the run.`);
  } catch (error) {
    warn("Startup cleanup failed; test execution will continue.", error);
  }
}

export async function runE2ETeardownCleanup() {
  try {
    const session = await readCachedRestSession();
    if (!session) {
      warn("No cached cleanup session is available; teardown cleanup skipped without re-authenticating.");
      return;
    }

    const deleted = await deleteMatchingTrips(session, (trip) => belongsToCurrentE2ERun(trip.name));
    if (deleted > 0) warn(`Removed ${deleted} trip(s) created by this E2E run.`);

    const remaining = (await listOwnedTrips(session)).filter((trip) => isTestTripName(trip.name));
    if (remaining.length > LEFTOVER_WARNING_THRESHOLD) {
      warn(
        `${remaining.length} E2E test trips still belong to the E2E account after cleanup (warning threshold: ${LEFTOVER_WARNING_THRESHOLD}).`,
      );
    }
  } catch (error) {
    warn("Teardown cleanup failed; the Playwright result will not be changed.", error);
  }
}
