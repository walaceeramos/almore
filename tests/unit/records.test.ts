import { describe, expect, it } from "vitest";
import {
  computeRecords,
  estimateOneRepMax,
  sessionRecordMarks,
  setRecordValues,
  type RecordSet,
} from "@/core/domain/records";
import type { DomainSet } from "@/core/domain/types";

function serie(weightKg: number | null, reps: number, extra: Partial<RecordSet> = {}): RecordSet {
  return {
    id: extra.id ?? `s-${weightKg}-${reps}-${extra.achievedAt ?? ""}`,
    sessionId: extra.sessionId ?? "sessao-1",
    achievedAt: extra.achievedAt ?? "2026-10-01T10:00:00Z",
    kind: extra.kind ?? "trabalho",
    weightKg,
    reps,
    rir: null,
  };
}

describe("estimateOneRepMax", () => {
  it("uma repetição é a própria carga", () => {
    expect(estimateOneRepMax(100, 1)).toEqual({ valueKg: 100, weak: false });
  });

  it("aplica Epley", () => {
    // 100 × (1 + 10/30) = 133,33
    expect(estimateOneRepMax(100, 10)).toEqual({ valueKg: 133.33, weak: false });
  });

  it("12 repetições ainda é confiável; 13 é estimativa fraca", () => {
    expect(estimateOneRepMax(50, 12)?.weak).toBe(false);
    expect(estimateOneRepMax(50, 13)?.weak).toBe(true);
  });

  it("sem carga ou sem repetição não estima", () => {
    expect(estimateOneRepMax(null, 10)).toBeNull();
    expect(estimateOneRepMax(0, 10)).toBeNull();
    expect(estimateOneRepMax(80, 0)).toBeNull();
  });
});

describe("setRecordValues", () => {
  it("aquecimento e peso corporal puro não contam", () => {
    expect(setRecordValues({ kind: "aquecimento", weightKg: 60, reps: 10, rir: null })).toBeNull();
    expect(setRecordValues({ kind: "trabalho", weightKg: null, reps: 15, rir: null })).toBeNull();
  });

  it("volume da série sem erro de ponto flutuante", () => {
    expect(setRecordValues({ kind: "trabalho", weightKg: 1.1, reps: 3, rir: null })?.volume_serie).toBe(3.3);
  });
});

describe("computeRecords", () => {
  it("sem séries válidas não há recorde", () => {
    expect(computeRecords([])).toEqual({});
    expect(computeRecords([serie(60, 10, { kind: "aquecimento" })])).toEqual({});
  });

  it("cada tipo pode vir de uma série diferente", () => {
    const pesada = serie(100, 2, { id: "pesada" });
    const longa = serie(80, 12, { id: "longa" });
    const r = computeRecords([pesada, longa]);

    expect(r.carga_maxima?.setId).toBe("pesada");
    expect(r.carga_maxima?.value).toBe(100);
    // 80 × (1 + 12/30) = 112 > 100 × (1 + 2/30) = 106,67
    expect(r.melhor_serie?.setId).toBe("longa");
    expect(r.volume_serie?.setId).toBe("longa");
    expect(r.volume_serie?.value).toBe(960);
  });

  it("empate não troca o recorde: fica com quem chegou primeiro", () => {
    const antes = serie(100, 5, { id: "antes", achievedAt: "2026-09-01T10:00:00Z", sessionId: "a" });
    const depois = serie(100, 5, { id: "depois", achievedAt: "2026-10-01T10:00:00Z", sessionId: "b" });
    // A ordem de entrada não importa: ordena pela data.
    expect(computeRecords([depois, antes]).carga_maxima?.setId).toBe("antes");
  });

  it("volume da sessão soma as séries de trabalho da mesma sessão", () => {
    const r = computeRecords([
      serie(80, 10, { id: "1", sessionId: "a", achievedAt: "2026-09-01T10:00:00Z" }),
      serie(80, 10, { id: "2", sessionId: "a", achievedAt: "2026-09-01T10:05:00Z" }),
      serie(100, 5, { id: "3", sessionId: "b", achievedAt: "2026-10-01T10:00:00Z" }),
    ]);
    expect(r.volume_sessao?.sessionId).toBe("a");
    expect(r.volume_sessao?.value).toBe(1600);
    expect(r.volume_sessao?.setId).toBeNull();
  });

  it("carga adicional de peso corporal conta como carga", () => {
    const r = computeRecords([serie(10, 8)]);
    expect(r.carga_maxima?.value).toBe(10);
  });
});

describe("sessionRecordMarks", () => {
  const t = (weightKg: number | null, reps: number, kind: DomainSet["kind"] = "trabalho"): DomainSet => ({
    kind,
    weightKg,
    reps,
    rir: null,
  });

  it("marca o que supera o recorde anterior", () => {
    const marcas = sessionRecordMarks([t(80, 10), t(105, 1)], {
      carga_maxima: 100,
      melhor_serie: 110,
      volume_serie: 900,
    });
    expect(marcas[0]).toEqual([]);
    expect(marcas[1]).toEqual(["carga_maxima"]);
  });

  it("primeira vez no exercício não é recorde, mas a série seguinte que supera é", () => {
    const marcas = sessionRecordMarks([t(80, 8), t(85, 8)], {});
    expect(marcas[0]).toEqual([]);
    expect(marcas[1]).toEqual(["carga_maxima", "melhor_serie", "volume_serie"]);
  });

  it("aquecimento nunca marca", () => {
    expect(sessionRecordMarks([t(200, 1, "aquecimento")], { carga_maxima: 100 })[0]).toEqual([]);
  });
});
