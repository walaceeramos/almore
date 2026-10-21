import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Dois conjuntos, ambos em Node, sem navegador:
 *
 * - `tests/unit` — regras puras de `src/core/domain`. Não tocam em banco;
 *   é o que o invariante de pureza garante.
 * - `tests/data` — `core/data` e `features/*\/actions.ts`, contra o
 *   IndexedDB de mentira que `setup-indexeddb.ts` instala. É onde vivem as
 *   travas que o Postgres dava de graça: cascade, SET NULL, uma rotina
 *   ativa, uma sessão em andamento.
 *
 * O setup roda para os dois. Nos puros ele só define globais que ninguém usa.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/data/**/*.test.ts"],
    setupFiles: ["tests/setup-indexeddb.ts"],
    environment: "node",
  },
});
