// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { fileURLToPath } from "node:url";

// E2E=1 troca o SDK real do Supabase por um backend em memória
// (src/e2e/supabase-stub.ts). Só para os testes E2E; o build normal não é
// afetado porque o alias só existe com a variável ligada.
const isE2E = process.env.E2E === "1";
const stubPath = fileURLToPath(new URL("./src/e2e/supabase-stub.ts", import.meta.url));

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    ...(isE2E
      ? {
          resolve: {
            alias: {
              "@supabase/supabase-js": stubPath,
            },
          },
        }
      : {}),
    server: {
      // Allow the sandbox/preview hosts (and any localhost variant) to reach
      // the dev server. Without this Vite blocks requests that arrive with a
      // Host header other than localhost.
      allowedHosts: [
        "work-1-qucdqcijhbbztwvr.prod-runtime.all-hands.dev",
        "work-2-qucdqcijhbbztwvr.prod-runtime.all-hands.dev",
        ".all-hands.dev",
        ".prod-runtime.all-hands.dev",
        "localhost",
        "127.0.0.1",
      ],
    },
  },
});
