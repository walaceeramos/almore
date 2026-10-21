import { describe, expect, it } from "vitest";
import { db } from "@/core/data/db";
import { CATALOG } from "@/core/data/catalog";
import {
  activateRoutine,
  addDay,
  addExercise,
  archiveRoutine,
  createRoutine,
  duplicateRoutine,
  removeDay,
  reorderDays,
} from "@/features/routines/actions";
import { bancoLimpo, criaPrograma, fd } from "./helpers";

/**
 * As travas que o Postgres garantia na 0005 agora são código. Ninguém as
 * verificava: é o que estes testes passam a fazer.
 */

bancoLimpo();

const SUPINO = CATALOG[0]!.id;
const SEGUNDO = CATALOG[1]!.id;

describe("createRoutine", () => {
  it("cria o programa com os dias já numerados", async () => {
    const { rotina, dias } = await criaPrograma("Push Pull Legs", 5);

    expect(rotina.isActive).toBe(false);
    expect(rotina.archivedAt).toBeNull();
    expect(dias).toHaveLength(5);
    expect(dias.map((d) => d.position)).toEqual([0, 1, 2, 3, 4]);
    expect(dias[0]!.name).toBe("Dia A");
    expect(dias[4]!.name).toBe("Dia E");
  });

  it("recusa nome curto sem gravar nada", async () => {
    const r = await createRoutine({}, fd({ name: "x", dayCount: "3" }));

    expect(r.fieldErrors?.name).toBeDefined();
    expect(await db.routines.count()).toBe(0);
    expect(await db.routineDays.count()).toBe(0);
  });
});

describe("addExercise", () => {
  it("adiciona exercício do catálogo, cujo id é slug", async () => {
    const { dias } = await criaPrograma();

    const r = await addExercise({}, fd({ routineDayId: dias[0]!.id, exerciseId: SUPINO }));

    expect(r.error).toBeUndefined();
    const prescricoes = await db.routineExercises.toArray();
    expect(prescricoes).toHaveLength(1);
    expect(prescricoes[0]!.exerciseId).toBe(SUPINO);
  });

  it("numera a posição na sequência dentro do dia", async () => {
    const { dias } = await criaPrograma();
    await addExercise({}, fd({ routineDayId: dias[0]!.id, exerciseId: SUPINO }));
    await addExercise({}, fd({ routineDayId: dias[0]!.id, exerciseId: SEGUNDO }));

    const posicoes = (await db.routineExercises.toArray()).map((e) => e.position).sort();
    expect(posicoes).toEqual([0, 1]);
  });

  it("avisa em vez de sair calado quando o exercício não existe", async () => {
    const { dias } = await criaPrograma();

    const r = await addExercise({}, fd({ routineDayId: dias[0]!.id, exerciseId: "nao-existe" }));

    expect(r.error).toBeTruthy();
    expect(await db.routineExercises.count()).toBe(0);
  });
});

describe("uma rotina ativa por vez", () => {
  it("ativar a segunda desativa a primeira", async () => {
    const a = await criaPrograma("Alfa");
    const b = await criaPrograma("Beta");

    await activateRoutine(fd({ id: a.rotina.id }));
    await activateRoutine(fd({ id: b.rotina.id }));

    const ativas = (await db.routines.toArray()).filter((r) => r.isActive);
    expect(ativas.map((r) => r.id)).toEqual([b.rotina.id]);
  });

  it("arquivar desliga o ativo, porque arquivada e ativa não convivem", async () => {
    const { rotina } = await criaPrograma("Alfa");
    await activateRoutine(fd({ id: rotina.id }));

    await archiveRoutine(fd({ id: rotina.id }));

    const depois = (await db.routines.get(rotina.id))!;
    expect(depois.isActive).toBe(false);
    expect(depois.archivedAt).not.toBeNull();
  });
});

describe("removeDay", () => {
  it("leva as prescrições do dia junto, como o cascade fazia", async () => {
    const { dias } = await criaPrograma("Alfa", 2);
    await addExercise({}, fd({ routineDayId: dias[0]!.id, exerciseId: SUPINO }));
    await addExercise({}, fd({ routineDayId: dias[1]!.id, exerciseId: SEGUNDO }));

    await removeDay(fd({ id: dias[0]!.id }));

    expect(await db.routineDays.count()).toBe(1);
    const restantes = await db.routineExercises.toArray();
    expect(restantes).toHaveLength(1);
    expect(restantes[0]!.routineDayId).toBe(dias[1]!.id);
  });
});

describe("reorderDays", () => {
  it("grava a ordem inteira de uma vez", async () => {
    const { dias } = await criaPrograma("Alfa", 3);
    const invertido = [dias[2]!.id, dias[1]!.id, dias[0]!.id];

    await reorderDays(fd({ ids: invertido }));

    const depois = await db.routineDays.bulkGet(invertido);
    expect(depois.map((d) => d!.position)).toEqual([0, 1, 2]);
  });
});

describe("addDay", () => {
  it("entra no fim da sequência", async () => {
    const { rotina } = await criaPrograma("Alfa", 2);

    await addDay(fd({ routineId: rotina.id }));

    const dias = await db.routineDays.where("routineId").equals(rotina.id).toArray();
    expect(dias).toHaveLength(3);
    expect(Math.max(...dias.map((d) => d.position))).toBe(2);
  });
});

describe("duplicateRoutine", () => {
  it("copia dias e prescrições, e a cópia não nasce ativa", async () => {
    const { rotina, dias } = await criaPrograma("Original", 2);
    await addExercise({}, fd({ routineDayId: dias[0]!.id, exerciseId: SUPINO }));
    await activateRoutine(fd({ id: rotina.id }));

    const novoId = await duplicateRoutine(fd({ id: rotina.id }));

    expect(novoId).toBeTruthy();
    const copia = (await db.routines.get(novoId!))!;
    expect(copia.name).toContain("Original");
    expect(copia.isActive).toBe(false);

    const diasCopia = await db.routineDays.where("routineId").equals(copia.id).toArray();
    expect(diasCopia).toHaveLength(2);

    const prescricoesCopia = await db.routineExercises
      .where("routineDayId")
      .anyOf(diasCopia.map((d) => d.id))
      .toArray();
    expect(prescricoesCopia).toHaveLength(1);
    expect(prescricoesCopia[0]!.exerciseId).toBe(SUPINO);
    // Cópia de verdade: ids novos, não os do original.
    expect(prescricoesCopia[0]!.routineDayId).not.toBe(dias[0]!.id);
  });
});
