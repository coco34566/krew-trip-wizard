import { runE2ETeardownCleanup } from "./e2e-trip-cleanup";

export default async function globalTeardown() {
  await runE2ETeardownCleanup();
}
