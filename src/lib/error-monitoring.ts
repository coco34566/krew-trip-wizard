type MonitoringContext = {
  route?: string;
  environment?: string;
  build?: string;
  action?: string;
  role?: string;
  tripId?: string;
  operation?: string;
  [key: string]: unknown;
};

const SENSITIVE_KEY = /email|e-mail|first.?name|last.?name|full.?name|display.?name|questionnaire|free.?text|note|allerg|diet|food|password|secret|token|authorization|cookie|session|access.?key|api.?key/i;
const capturedErrors = new WeakSet<Error>();
let installed = false;

function scrubString(value: string) {
  return value
    .replace(/([?&](?:token|key|secret|code|auth)[^=]*)=[^&#\s]*/gi, "$1=[Redacted]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[Redacted email]")
    .replace(/\b(Bearer\s+)[A-Z0-9._~+\/-]+=*\b/gi, "$1[Redacted]")
    .replace(/\b(password|passwd|token|secret|authorization|api[_ -]?key|access[_ -]?key)\s*[:=]\s*[^\s,;&#]+/gi, "$1=[Redacted]");
}

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[Truncated]";
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    const redacted = scrubString(value);
    if (redacted.length > 500) return `${redacted.slice(0, 500)}…`;
    return redacted;
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => scrub(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        SENSITIVE_KEY.test(key) ? "[Redacted]" : scrub(child, depth + 1),
      ]),
    );
  }
  return String(value);
}

function getDsn() {
  if (typeof window !== "undefined") return import.meta.env.VITE_SENTRY_DSN as string | undefined;
  return process.env.SENTRY_DSN;
}

function sentryEndpoint(dsn: string) {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, "");
    if (!url.username || !projectId) return null;
    return `${url.protocol}//${url.host}/api/${projectId}/envelope/?sentry_version=7&sentry_key=${encodeURIComponent(url.username)}`;
  } catch {
    return null;
  }
}

function environment() {
  if (typeof window === "undefined") return process.env.VERCEL_ENV || process.env.NODE_ENV || "server";
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return "development";
  if (host.endsWith(".vercel.app")) return "preview";
  return "production";
}

export function scrubMonitoringContext(context: MonitoringContext) {
  return scrub(context) as Record<string, unknown>;
}

/**
 * Sends a minimal Sentry event through the standard envelope ingestion API.
 * It uses no cookies, user identity, session replay, DOM/input capture or breadcrumbs.
 */
export async function captureProductionError(error: unknown, context: MonitoringContext = {}) {
  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");
  if (capturedErrors.has(err)) return false;
  capturedErrors.add(err);

  const dsn = getDsn();
  if (!dsn) return false;
  const endpoint = sentryEndpoint(dsn);
  if (!endpoint) return false;

  const eventId = crypto.randomUUID().replace(/-/g, "");
  const safeContext = scrubMonitoringContext({
    ...context,
    route: context.route ?? (typeof window !== "undefined" ? window.location.pathname : undefined),
    environment: context.environment ?? environment(),
    build:
      context.build ??
      (typeof window !== "undefined"
        ? (import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA as string | undefined)
        : process.env.VERCEL_GIT_COMMIT_SHA),
  });
  const payload = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: "error",
    environment: safeContext.environment,
    release: safeContext.build,
    exception: { values: [{ type: err.name || "Error", value: String(scrub(err.message)) }] },
    contexts: { krew: safeContext },
    extra: { stack: scrub(err.stack) },
  };
  const envelope = `${JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() })}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(payload)}`;

  try {
    await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-sentry-envelope" },
      body: envelope,
      credentials: "omit",
      keepalive: typeof window !== "undefined",
    });
    return true;
  } catch {
    return false;
  }
}

export function installGlobalErrorMonitoring() {
  if (typeof window === "undefined" || installed) return;
  installed = true;
  window.addEventListener("error", (event) => {
    void captureProductionError(event.error ?? new Error(event.message), { action: "window.error" });
  });
  window.addEventListener("unhandledrejection", (event) => {
    void captureProductionError(event.reason, { action: "unhandledrejection" });
  });
}