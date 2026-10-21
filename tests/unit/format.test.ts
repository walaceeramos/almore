import { describe, expect, it } from "vitest";
import { kg } from "@/core/utils/format";

/**
 * Regressão: a versão anterior cortava zeros à direita sem exigir ponto
 * decimal, então `kg(80)` devolvia "8" e `kg(100)` devolvia "1". Ficava
 * escondido porque quem chama passa `toFixed(2)`.
 */
describe("kg", () => {
  it.each([
    [80, "80"],
    [100, "100"],
    [20, "20"],
    [10, "10"],
    [0, "0"],
  ])("não morde o inteiro: kg(%s) = %s", (entrada, esperado) => {
    expect(kg(entrada)).toBe(esperado);
  });

  it.each([
    [2.5, "2,5"],
    [0.5, "0,5"],
    [1.25, "1,25"],
    [22.75, "22,75"],
  ])("usa vírgula decimal: kg(%s) = %s", (entrada, esperado) => {
    expect(kg(entrada)).toBe(esperado);
  });

  it.each([
    ["80.00", "80"],
    ["2.50", "2,5"],
    ["100.00", "100"],
    ["1.25", "1,25"],
    ["0.00", "0"],
  ])("aceita string formatada: kg(%s) = %s", (entrada, esperado) => {
    expect(kg(entrada)).toBe(esperado);
  });

  it("dá o mesmo resultado com e sem toFixed, que é como as telas chamam", () => {
    for (const n of [80, 2.5, 100, 1.25, 0.5]) {
      expect(kg(n)).toBe(kg(n.toFixed(2)));
    }
  });
});
