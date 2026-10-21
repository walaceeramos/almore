import { describe, expect, it } from "vitest";
import { CATALOG } from "@/core/data/catalog";
import { exerciseIdSchema, rowIdSchema } from "@/core/data/id-schemas";
import { addExerciseSchema } from "@/features/routines/schemas";
import { addSessionExerciseSchema } from "@/features/sessions/schemas";

/**
 * Regressão: `exerciseId` já foi validado como UUID, o que rejeitava todo
 * exercício do catálogo, cujo id é o slug. As ações saíam caladas quando o
 * Zod barrava, então o botão de adicionar parecia morto.
 */

const UUID = "0b9e3f1a-2c4d-4e5f-8a9b-1c2d3e4f5a6b";

describe("exerciseIdSchema", () => {
  it("aceita o id de todo exercício do catálogo", () => {
    const recusados = CATALOG.filter((e) => !exerciseIdSchema.safeParse(e.id).success).map((e) => e.id);
    expect(recusados).toEqual([]);
  });

  it("tem catálogo com slug, não UUID", () => {
    // Se isto mudar, a premissa do schema mudou junto.
    expect(CATALOG.length).toBeGreaterThan(0);
    expect(CATALOG[0]!.id).toMatch(/^[a-z0-9-]+$/);
    expect(rowIdSchema.safeParse(CATALOG[0]!.id).success).toBe(false);
  });

  it("aceita UUID, que é o id do exercício personalizado", () => {
    expect(exerciseIdSchema.safeParse(UUID).success).toBe(true);
  });

  it.each([
    ["vazio", ""],
    ["só espaço", "   "],
    ["com espaço no meio", "supino reto"],
    ["com barra", "../etc/passwd"],
    ["com acento", "supino-inclinadó"],
  ])("recusa id %s", (_rotulo, valor) => {
    expect(exerciseIdSchema.safeParse(valor).success).toBe(false);
  });
});

describe("rowIdSchema", () => {
  it("continua exigindo UUID para linha criada pelo app", () => {
    expect(rowIdSchema.safeParse(UUID).success).toBe(true);
    expect(rowIdSchema.safeParse("dia-a").success).toBe(false);
  });
});

describe("as ações que recebem exerciseId", () => {
  const primeiro = CATALOG[0]!.id;

  it("addExerciseSchema aceita exercício do catálogo no editor de programa", () => {
    expect(addExerciseSchema.safeParse({ routineDayId: UUID, exerciseId: primeiro }).success).toBe(true);
  });

  it("addSessionExerciseSchema aceita exercício do catálogo durante o treino", () => {
    expect(addSessionExerciseSchema.safeParse({ sessionId: UUID, exerciseId: primeiro }).success).toBe(true);
  });

  it("continuam exigindo UUID na linha do próprio app", () => {
    expect(addExerciseSchema.safeParse({ routineDayId: "dia-a", exerciseId: primeiro }).success).toBe(false);
    expect(addSessionExerciseSchema.safeParse({ sessionId: "sessao-1", exerciseId: primeiro }).success).toBe(false);
  });
});
