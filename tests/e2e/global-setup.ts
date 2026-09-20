import { runE2EStartupCleanup } from "./e2e-trip-cleanup";

export default async function globalSetup() {
  await runE2EStartupCleanup();
}
