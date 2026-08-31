export const KREW_CONSENT_STORAGE_KEY = "krew-cookie-consent";
export const KREW_CONSENT_EVENT = "krew:cookie-consent-changed";

export type ProductAnalyticsEvent =
  | "trip_created"
  | "participant_invited"
  | "participant_joined"
  | "availability_submitted"
  | "preferences_submitted"
  | "dates_locked"
  | "trip_profile_validated"
  | "destination_proposals_generated"
  | "destination_selected"
  | "accommodation_selected"
  | "transport_selected"
  | "planning_generated"
  | "trip_started"
  | "trip_completed"
  | "trip_archived"
  | "trip_reactivated"
  | "participant_marked_absent"
  | "destination_generation_failed"
  | "accommodation_generation_failed"
  | "transport_generation_failed"
  | "planning_generation_failed";

export type ProductAnalyticsProperties = {
  role?: "organizer" | "co_organizer" | "participant";
  trip_type?: string;
  group_size?: number;
  journey_step?: string;
  expected_responses?: number;
  received_responses?: number;
  dates_locked?: boolean;
  destination_selected?: boolean;
  environment?: "production" | "preview" | "development";
  build?: string;
  trip_id?: string;
  operation?: string;
};

const FORBIDDEN_PROPERTY = /email|e-mail|first.?name|last.?name|full.?name|display.?name|questionnaire|free.?text|note|allerg|diet|food|token|secret|password|authorization|cookie/i;
let analyticsAllowed = false;
let initialized = false;

function readConsentFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(KREW_CONSENT_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { analytics?: unknown };
    return parsed.analytics === true;
  } catch {
    return false;
  }
}

function safeProperties(properties: ProductAnalyticsProperties = {}) {
  return Object.fromEntries(
    Object.entries(properties).filter(([key, value]) =>
      !FORBIDDEN_PROPERTY.test(key) && value !== undefined && value !== null,
    ),
  );
}

function getEnvironment(): "production" | "preview" | "development" {
  if (typeof window === "undefined") return "development";
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return "development";
  if (host.endsWith(".vercel.app")) return "preview";
  return "production";
}

function getSessionDistinctId() {
  const key = "krew-analytics-session-id";
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const next = crypto.randomUUID();
    window.sessionStorage.setItem(key, next);
    return next;
  } catch {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function initializeProductAnalyticsConsent() {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;
  analyticsAllowed = readConsentFromStorage();
  window.addEventListener(KREW_CONSENT_EVENT, ((event: CustomEvent<{ analytics?: boolean }>) => {
    analyticsAllowed = event.detail?.analytics === true;
  }) as EventListener);
}

export function isProductAnalyticsEnabled() {
  if (typeof window === "undefined") return false;
  if (!initialized) initializeProductAnalyticsConsent();
  return analyticsAllowed;
}

/**
 * Lightweight PostHog capture without autocapture, cookies or session replay.
 * No request is emitted until KREW's analytics consent is explicitly granted.
 */
export async function trackProductEvent(
  event: ProductAnalyticsEvent,
  properties: ProductAnalyticsProperties = {},
): Promise<boolean> {
  if (typeof window === "undefined" || !isProductAnalyticsEnabled()) return false;

  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  if (!key) return false;
  const host = String(import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com").replace(/\/$/, "");
  const payload = {
    api_key: key,
    event,
    properties: {
      distinct_id: getSessionDistinctId(),
      ...safeProperties(properties),
      environment: properties.environment ?? getEnvironment(),
      build: properties.build ?? (import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA as string | undefined),
    },
    timestamp: new Date().toISOString(),
  };

  try {
    await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: "omit",
    });
    return true;
  } catch {
    return false;
  }
}

export function trackProductEventOnce(
  event: ProductAnalyticsEvent,
  dedupeKey: string,
  properties: ProductAnalyticsProperties = {},
) {
  if (typeof window === "undefined" || !isProductAnalyticsEnabled()) return;
  const key = `krew-analytics-once:${event}:${dedupeKey}`;
  try {
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
  } catch {
    // Tracking still works when storage is unavailable; only dedupe is lost.
  }
  void trackProductEvent(event, properties);
}
