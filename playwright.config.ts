import { defineConfig, devices } from "@playwright/test";

/**
 * E2E do cardápio público.
 *
 * Sobe o dev server com E2E=1, que troca o SDK do Supabase por um backend em
 * memória (src/e2e/supabase-stub.ts). Não precisa de Supabase real: os testes
 * dirigem a UI de verdade e as consultas caem no stub.
 *
 * Rodar: `npm run test:e2e` (ou `npm run test:e2e:ui`).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : [["list"]],
  use: {
    baseURL: "http://127.0.0.1:8099",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      "E2E=1 VITE_SUPABASE_URL=https://e2e.supabase.co VITE_SUPABASE_ANON_KEY=e2e-anon-key vite dev --port 8099 --strictPort",
    url: "http://127.0.0.1:8099",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
