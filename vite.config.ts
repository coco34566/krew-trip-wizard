// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
  vite: {
    plugins: [mcpPlugin()],
    // KREW is deployed on Vercel with NEXT_PUBLIC_* Supabase variables.
    // The Lovable Vite config only exposes VITE_* variables by default, so explicitly
    // expose the two safe, client-side Supabase values needed by the browser bundle.
    define: {
      "import.meta.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
      "import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""),
    },
  },
});
