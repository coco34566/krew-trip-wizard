import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths() as unknown],
  test: {
    environment: "jsdom",
    globals: true,
  },
});
