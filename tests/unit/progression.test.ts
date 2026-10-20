import { describe, expect, it } from "vitest";
import { suggestProgression } from "@/core/domain/progression";
import type { DomainSet, ExerciseSession, RepRange } from "@/core/domain/types";

const faixa: RepRange = { targetSets: 3, repMin: 8, repMax: 12, targetRir: 2 };

function series(weightKg: number | null, reps: number[], rir: number | null = 2): DomainSet[] {
  return reps.map((r) => ({ kind: "trabalho", weightKg, reps: r, rir }));
}

function sessao(sets: DomainSet[], range: RepRange = faixa): ExerciseSession {
  return { ...range, sets };
}

describe("suggestProgression", () => {
  it("primeira vez: sem carga sugerida, fundo da faixa", () => {
    const v = suggestProgression(faixa, 2.5, []);
    expect(v.action).toBe("primeira_vez");
    expect(v.weightKg).toBeNull();
    expect(v.reps).toBe(8);
  });

  it("sessão só de aquecimento não conta como histórico", () => {
    const aquecimento: DomainSet[] = [{ kind: "aquecimento", weightKg: 40, reps: 12, rir: null }];
    expect(suggestProgression(faixa, 2.5, [sessao(aquecimento)]).action).toBe("primeira_vez");
  });

  it("todas no topo dentro do RIR alvo: sobe um incremento e volta ao fundo", () => {
    const v = suggestProgression(faixa, 2.5, [sessao(series(80, [12, 12, 12]))]);
    expect(v).toMatchObject({ action: "subir", weightKg: 82.5, reps: 8 });
  });

  it("incremento fracionado não acumula erro", () => {
    const v = suggestProgression(faixa, 1.25, [sessao(series(21.25, [12, 12, 12]))]);
    expect(v.weightKg).toBe(22.5);
  });

  it("topo da faixa, mas abaixo do RIR alvo (perto demais da falha): mantém", () => {
    const v = suggestProgression(faixa, 2.5, [sessao(series(80, [12, 12, 12], 0))]);
    expect(v.action).toBe("manter");
    expect(v.weightKg).toBe(80);
  });

  it("série sem RIR anotado conta como dentro do alvo", () => {
    const v = suggestProgression(faixa, 2.5, [sessao(series(80, [12, 12, 12], null))]);
    expect(v.action).toBe("subir");
  });

  it("fez menos séries que as prescritas: não sobe", () => {
    const v = suggestProgression(faixa, 2.5, [sessao(series(80, [12, 12]))]);
    expect(v.action).toBe("manter");
  });

  it("uma sessão abaixo do fundo não reduz: um treino ruim não é tendência", () => {
    const v = suggestProgression(faixa, 2.5, [sessao(series(80, [9, 7, 6])), sessao(series(80, [10, 9, 8]))]);
    expect(v.action).toBe("manter");
  });

  it("abaixo do fundo em duas sessões seguidas: reduz um incremento", () => {
    const v = suggestProgression(faixa, 2.5, [sessao(series(80, [8, 7, 6])), sessao(series(80, [9, 8, 7]))]);
    expect(v).toMatchObject({ action: "reduzir", weightKg: 77.5, reps: 8 });
  });

  it("mantém buscando uma repetição a mais, sem passar do topo", () => {
    expect(suggestProgression(faixa, 2.5, [sessao(series(80, [10, 9, 9]))])).toMatchObject({
      action: "manter",
      weightKg: 80,
      reps: 10,
    });
    expect(suggestProgression(faixa, 2.5, [sessao(series(80, [12, 12, 11]))]).reps).toBe(12);
  });

  it("pirâmide: a referência é a série mais pesada", () => {
    const sets: DomainSet[] = [
      { kind: "trabalho", weightKg: 70, reps: 12, rir: 2 },
      { kind: "trabalho", weightKg: 80, reps: 10, rir: 2 },
    ];
    expect(suggestProgression({ ...faixa, targetSets: 2 }, 2.5, [sessao(sets)]).weightKg).toBe(80);
  });

  it("cada sessão é julgada pela faixa que valia nela", () => {
    // Antes a faixa era 6 a 8: 8 repetições era o topo.
    const antiga = sessao(series(100, [8, 8, 8]), { targetSets: 3, repMin: 6, repMax: 8, targetRir: 2 });
    const v = suggestProgression(faixa, 2.5, [antiga]);
    expect(v).toMatchObject({ action: "subir", weightKg: 102.5, reps: 8 });
  });

  it("peso corporal no topo: sugere repetições, não carga", () => {
    const v = suggestProgression(faixa, 2.5, [sessao(series(null, [12, 12, 12]))]);
    expect(v).toMatchObject({ action: "manter", weightKg: null, reps: 13 });
  });

  it("peso corporal abaixo do fundo duas vezes: não há carga para reduzir", () => {
    const v = suggestProgression(faixa, 2.5, [sessao(series(null, [6, 5, 5])), sessao(series(null, [7, 6, 5]))]);
    expect(v).toMatchObject({ action: "manter", weightKg: null, reps: 8 });
  });

  it("redução nunca vai abaixo de zero", () => {
    const v = suggestProgression(faixa, 5, [sessao(series(2.5, [5, 5, 5])), sessao(series(2.5, [6, 5, 5]))]);
    expect(v.weightKg).toBe(0);
  });

  it("exercício sem prescrição: repete a última carga", () => {
    const livre: RepRange = { targetSets: null, repMin: null, repMax: null, targetRir: null };
    const v = suggestProgression(livre, 2.5, [sessao(series(40, [15, 12]), livre)]);
    expect(v).toMatchObject({ action: "manter", weightKg: 40, reps: 12 });
  });
});
