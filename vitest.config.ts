import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Config isolada do app: os testes cobrem lógica pura e componentes pequenos,
// então não carregamos os plugins do TanStack Start/Vite (build lento e com
// side effects). Só o alias `@` e o ambiente DOM são necessários.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
  },
});
