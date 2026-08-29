import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths() as unknown],
  test: {
    environment: "jsdom",
    globals: true,
    testTimeout: 10_000,
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "src/**/*.spec.ts",
      "src/**/*.spec.tsx",
    ],
    exclude: [
      // These suites still use bun:test and are intentionally kept out of Vitest.
      "src/lib/__tests__/questionnaire-and-profile-access.test.ts",
      "src/lib/krew/__tests__/getyourguide.test.ts",
      "src/routes/_authenticated/__tests__/trips.$tripId.profile-accessibility.test.ts",
      // Legacy planning suite contains a native CommonJS require('@/...') that bypasses
      // Vite path resolution. The current planning suite remains covered separately.
      "src/lib/krew/__tests__/planning-engine.test.ts",
    ],
  },
});
