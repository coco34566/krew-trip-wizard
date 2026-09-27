export const TEST_TRIP_PREFIXES = [
  "E2E-KREW-",
  "E2E-FULL-",
  "VISUAL-AUDIT-",
  "JOIN-VISUAL-AUDIT-",
] as const;

export type TestTripPrefix = (typeof TEST_TRIP_PREFIXES)[number];

const RUN_TOKEN_ENV = "KREW_E2E_RUN_TOKEN";

export function ensureE2ERunToken() {
  if (!process.env[RUN_TOKEN_ENV]) {
    const githubToken = [process.env.GITHUB_RUN_ID, process.env.GITHUB_RUN_ATTEMPT].filter(Boolean).join("-");
    process.env[RUN_TOKEN_ENV] = githubToken || `local-${process.pid}-${Date.now()}`;
  }
  return process.env[RUN_TOKEN_ENV]!;
}

export function getE2ERunToken() {
  return process.env[RUN_TOKEN_ENV] ?? "";
}

export function testTripName(prefix: TestTripPrefix) {
  return `${prefix}${ensureE2ERunToken()}-${Date.now()}`;
}

export function isTestTripName(name: string) {
  return TEST_TRIP_PREFIXES.some((prefix) => name.startsWith(prefix));
}

export function belongsToCurrentE2ERun(name: string) {
  const runToken = getE2ERunToken();
  return Boolean(runToken && isTestTripName(name) && name.includes(`${runToken}-`));
}
