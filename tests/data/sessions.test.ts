import { describe, expect, it } from "vitest";
import { db } from "@/core/data/db";
import { CATALOG } from "@/core/data/catalog";
import { addExercise, removeDay } from "@/features/routines/actions";
import { addSessionExercise, discardSession, startSession } from "@/features/sessions/actions";
import { bancoLimpo, criaPrograma, fd } from "./helpers";

bancoLimpo();

const SUPINO = CATALOG[0]!.id;
const SEGUNDO = CATALOG[1]!.id;

/** Programa com um dia e um exercício, pronto para iniciar treino. */
async function programaPronto() {
  const { rotina, dias } = await criaPrograma("Treino de teste", 1);
  await addExercise({}, fd({ routineDayId: dias[0]!.id, exerciseId: SUPINO }));
  return { rotina, dia: dias[0]! };
}

function idDaRota(redirectTo: string | undefined): string {
  return String(redirectTo).split("/")[2]!;
}

describe("startSession", () => {
  it("copia a prescrição vigente para a sessão", async () => {
    const { dia } = await programaPronto();
    const prescricao = (await db.routineExercises.toArray())[0]!;

    const r = await startSession({}, fd({ routineDayId: dia.id }));

    expect(r.error).toBeUndefined();
    const linhas = await db.sessionExercises.toArray();
    expect(linhas).toHaveLength(1);
    // Snapshot: editar o programa depois não pode reescrever o passado.
    expect(linhas[0]!.targetSets).toBe(prescricao.targetSets);
    expect(linhas[0]!.repMin).toBe(prescricao.repMin);
    expect(linhas[0]!.repMax).toBe(prescricao.repMax);
    expect(linhas[0]!.exerciseId).toBe(SUPINO);
  });

  it("uma sessão em andamento por vez: a segunda leva de volta à aberta", async () => {
    const { dia } = await programaPronto();

    const primeira = await startSession({}, fd({ routineDayId: dia.id }));
    const segunda = await startSession({}, fd({ routineDayId: dia.id }));

    expect(await db.sessions.count()).toBe(1);
    expect(segunda.redirectTo).toBe(primeira.redirectTo);
  });

  it("recusa programa arquivado", async () => {
    const { rotina, dia } = await programaPronto();
    await db.routines.update(rotina.id, { archivedAt: new Date().toISOString() });

    const r = await startSession({}, fd({ routineDayId: dia.id }));

    expect(r.error).toBeTruthy();
    expect(await db.sessions.count()).toBe(0);
  });
});

describe("addSessionExercise", () => {
  it("aceita exercício do catálogo fora do plano, cujo id é slug", async () => {
    const { dia } = await programaPronto();
    const inicio = await startSession({}, fd({ routineDayId: dia.id }));
    const sessaoId = idDaRota(inicio.redirectTo);

    const r = await addSessionExercise(fd({ sessionId: sessaoId, exerciseId: SEGUNDO }));

    expect(r.error).toBeUndefined();
    const ids = (await db.sessionExercises.toArray()).map((l) => l.exerciseId);
    expect(ids).toContain(SEGUNDO);
  });

  it("entra sem prescrição, porque está fora do plano", async () => {
    const { dia } = await programaPronto();
    const inicio = await startSession({}, fd({ routineDayId: dia.id }));
    const sessaoId = idDaRota(inicio.redirectTo);

    await addSessionExercise(fd({ sessionId: sessaoId, exerciseId: SEGUNDO }));

    const fora = (await db.sessionExercises.toArray()).find((l) => l.exerciseId === SEGUNDO)!;
    expect(fora.routineExerciseId).toBeNull();
  });
});

describe("execução aponta para o plano com SET NULL", () => {
  it("apagar o dia desliga a sessão sem apagá-la", async () => {
    const { dia } = await programaPronto();
    const inicio = await startSession({}, fd({ routineDayId: dia.id }));
    const sessaoId = idDaRota(inicio.redirectTo);

    await removeDay(fd({ id: dia.id }));

    const sessao = await db.sessions.get(sessaoId);
    expect(sessao).toBeDefined();
    expect(sessao!.routineDayId).toBeNull();

    const linhas = await db.sessionExercises.where("sessionId").equals(sessaoId).toArray();
    expect(linhas).toHaveLength(1);
    expect(linhas[0]!.routineExerciseId).toBeNull();
    // O histórico continua sabendo qual exercício foi feito.
    expect(linhas[0]!.exerciseId).toBe(SUPINO);
  });
});

describe("discardSession", () => {
  it("apaga a sessão em andamento e o que pende dela", async () => {
    const { dia } = await programaPronto();
    const inicio = await startSession({}, fd({ routineDayId: dia.id }));

    await discardSession(fd({ id: idDaRota(inicio.redirectTo) }));

    expect(await db.sessions.count()).toBe(0);
    expect(await db.sessionExercises.count()).toBe(0);
  });
});
