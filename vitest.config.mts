import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Testes de unidade das regras puras de `src/core/domain`. Rodam em Node,
 * sem navegador nem banco: é o que o invariante de pureza garante.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
