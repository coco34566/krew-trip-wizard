import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths() as unknown],
  test: {
    environment: "jsdom",
    globals: true,
    exclude: [
      "tests/e2e/**",
      "src/lib/__tests__/questionnaire-and-profile-access.test.ts",
      "src/lib/krew/__tests__/getyourguide.test.ts",
      "src/routes/_authenticated/__tests__/trips.$tripId.profile-accessibility.test.ts",
    ],
  },
});
