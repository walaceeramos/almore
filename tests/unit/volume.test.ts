import { describe, expect, it } from "vitest";
import { setsPerMuscle, tonnageKg } from "@/core/domain/volume";

const supino = [
  { muscleId: "peito", contribution: 1 },
  { muscleId: "triceps", contribution: 0.5 },
];

describe("setsPerMuscle", () => {
  it("primário conta 1 série, secundário 0,5", () => {
    const r = setsPerMuscle([
      { kind: "trabalho", muscles: supino },
      { kind: "trabalho", muscles: supino },
      { kind: "trabalho", muscles: supino },
    ]);
    expect(r).toEqual({ peito: 3, triceps: 1.5 });
  });

  it("aquecimento não conta", () => {
    expect(setsPerMuscle([{ kind: "aquecimento", muscles: supino }])).toEqual({});
  });

  it("exercício sem músculo cadastrado não soma em lugar nenhum", () => {
    expect(setsPerMuscle([{ kind: "trabalho", muscles: [] }])).toEqual({});
  });

  it("frações somam sem erro de ponto flutuante", () => {
    const tres = [{ muscleId: "x", contribution: 0.1 }];
    const r = setsPerMuscle([
      { kind: "trabalho", muscles: tres },
      { kind: "trabalho", muscles: tres },
      { kind: "trabalho", muscles: tres },
    ]);
    expect(r.x).toBe(0.3);
  });
});

describe("tonnageKg", () => {
  it("soma só trabalho com carga", () => {
    expect(
      tonnageKg([
        { kind: "trabalho", weightKg: "80.00", reps: 10 },
        { kind: "trabalho", weightKg: 82.5, reps: 8 },
        { kind: "aquecimento", weightKg: 40, reps: 10 },
        { kind: "trabalho", weightKg: null, reps: 12 },
      ]),
    ).toBe(1460);
  });

  it("anilha de 1,25 kg não acumula erro", () => {
    expect(tonnageKg([{ kind: "trabalho", weightKg: 1.25, reps: 3 }, { kind: "trabalho", weightKg: 1.1, reps: 3 }])).toBe(7.05);
  });
});
