import { describe, expect, it } from "vitest";
import { isStagnant } from "@/core/domain/stagnation";
import type { DomainSet } from "@/core/domain/types";

const s = (weightKg: number | null, reps: number): DomainSet[] => [{ kind: "trabalho", weightKg, reps, rir: null }];

describe("isStagnant", () => {
  it("precisa de quatro sessões: três para julgar e uma de referência", () => {
    expect(isStagnant([s(80, 8), s(80, 8), s(80, 8)])).toBe(false);
  });

  it("três sessões sem subir carga nem repetições: estagnado", () => {
    // Da mais recente para a mais antiga.
    expect(isStagnant([s(80, 8), s(80, 8), s(80, 8), s(80, 8)])).toBe(true);
  });

  it("uma repetição a mais na mesma carga já é evolução", () => {
    expect(isStagnant([s(80, 9), s(80, 8), s(80, 8), s(80, 8)])).toBe(false);
  });

  it("subir carga com menos repetições é evolução", () => {
    expect(isStagnant([s(80, 8), s(80, 8), s(82.5, 6), s(80, 10)])).toBe(false);
  });

  it("voltando de redução de carga não é estagnação, mesmo abaixo do recorde antigo", () => {
    expect(isStagnant([s(87.5, 8), s(85, 8), s(82.5, 8), s(100, 8)])).toBe(false);
  });

  it("peso corporal evolui por repetições", () => {
    expect(isStagnant([s(null, 10), s(null, 10), s(null, 10), s(null, 10)])).toBe(true);
    expect(isStagnant([s(null, 11), s(null, 10), s(null, 10), s(null, 10)])).toBe(false);
  });

  it("sessões só de aquecimento são ignoradas", () => {
    const aquecimento: DomainSet[] = [{ kind: "aquecimento", weightKg: 40, reps: 10, rir: null }];
    expect(isStagnant([s(80, 8), aquecimento, s(80, 8), s(80, 8)])).toBe(false);
  });
});
