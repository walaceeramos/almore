import { db } from "@/core/data/db";
import { findExercise } from "@/core/data/exercises";
import { nowIso, toKg } from "@/core/data/types";
import { newId } from "@/core/utils/uuid";
import { defaultDayName } from "./labels";
import {
  createRoutineSchema,
  renameRoutineSchema,
  routineIdSchema,
  daySchema,
  addDaySchema,
  addExerciseSchema,
  prescriptionSchema,
  reorderSchema,
  type RoutineActionState,
} from "./schemas";

/*
 * Programas no aparelho. As travas que o Postgres garantia na 0005 —
 * cascade de dias e prescrições, uma rotina ativa por usuário, CHECK de
 * faixa — agora são deste arquivo, sempre em `db.transaction`, que aqui é
 * atômica: o rollback manual da versão com banco deixa de existir.
 *
 * Execução aponta para o plano com SET NULL: apagar um dia ou uma
 * prescrição desliga as sessões que apontavam para eles, sem apagá-las.
 */

/** Prescrição inicial ao trazer um exercício do catálogo para o dia. */
const PRESCRICAO_PADRAO = { targetSets: 3, repMin: 8, repMax: 12, targetRir: 2 };

const ERRO_GRAVAR = "Não foi possível salvar no aparelho. Tente de novo.";

/* ------------------------------------------------------------------ *
 * Programa
 * ------------------------------------------------------------------ */

export async function createRoutine(_prev: RoutineActionState, formData: FormData): Promise<RoutineActionState> {
  const parsed = createRoutineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const id = newId();
  try {
    await db.transaction("rw", db.routines, db.routineDays, async () => {
      await db.routines.add({
        id,
        name: parsed.data.name,
        description: parsed.data.description || null,
        isActive: false,
        archivedAt: null,
        createdAt: nowIso(),
      });
      await db.routineDays.bulkAdd(
        Array.from({ length: parsed.data.dayCount }, (_, i) => ({
          id: newId(),
          routineId: id,
          name: defaultDayName(i),
          position: i,
          suggestedWeekday: null,
          notes: null,
        })),
      );
    });
  } catch {
    return { error: "Não foi possível criar o programa. Tente de novo." };
  }

  return { redirectTo: `/treinos/${id}/editar` };
}

export async function renameRoutine(_prev: RoutineActionState, formData: FormData): Promise<RoutineActionState> {
  const parsed = renameRoutineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const n = await db.routines.update(parsed.data.id, {
    name: parsed.data.name,
    description: parsed.data.description || null,
  });
  return n ? {} : { error: ERRO_GRAVAR };
}

/** Só uma rotina ativa: desativa as outras na mesma transação. */
export async function activateRoutine(formData: FormData) {
  const parsed = routineIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  await db.transaction("rw", db.routines, async () => {
    const alvo = await db.routines.get(parsed.data.id);
    if (!alvo || alvo.archivedAt) return;
    await db.routines.toCollection().modify((r) => {
      r.isActive = r.id === alvo.id;
    });
  });
}

/** Exclusão lógica: o histórico aponta para os dias. Ativa deixa de ser. */
export async function archiveRoutine(formData: FormData) {
  const parsed = routineIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await db.routines.update(parsed.data.id, { archivedAt: nowIso(), isActive: false });
}

export async function unarchiveRoutine(formData: FormData) {
  const parsed = routineIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await db.routines.update(parsed.data.id, { archivedAt: null });
}

/** Cópia com dias e prescrições. Devolve o id novo para a tela navegar. */
export async function duplicateRoutine(formData: FormData): Promise<string | null> {
  const parsed = routineIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return null;

  return db.transaction("rw", db.routines, db.routineDays, db.routineExercises, async () => {
    const origem = await db.routines.get(parsed.data.id);
    if (!origem) return null;

    const id = newId();
    await db.routines.add({
      id,
      name: `${origem.name} (cópia)`.slice(0, 60),
      description: origem.description,
      isActive: false,
      archivedAt: null,
      createdAt: nowIso(),
    });

    const dias = await db.routineDays.where("routineId").equals(origem.id).toArray();
    const novoId = new Map(dias.map((d) => [d.id, newId()]));
    await db.routineDays.bulkAdd(dias.map((d) => ({ ...d, id: novoId.get(d.id)!, routineId: id })));

    if (dias.length > 0) {
      const prescricoes = await db.routineExercises
        .where("routineDayId")
        .anyOf(dias.map((d) => d.id))
        .toArray();
      await db.routineExercises.bulkAdd(
        prescricoes.map((p) => ({ ...p, id: newId(), routineDayId: novoId.get(p.routineDayId)! })),
      );
    }
    return id;
  });
}

/* ------------------------------------------------------------------ *
 * Dias
 * ------------------------------------------------------------------ */

export async function addDay(formData: FormData) {
  const parsed = addDaySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  await db.transaction("rw", db.routineDays, async () => {
    const existentes = await db.routineDays.where("routineId").equals(parsed.data.routineId).toArray();
    const proxima = existentes.length === 0 ? 0 : Math.max(...existentes.map((d) => d.position)) + 1;
    await db.routineDays.add({
      id: newId(),
      routineId: parsed.data.routineId,
      name: defaultDayName(existentes.length),
      position: proxima,
      suggestedWeekday: null,
      notes: null,
    });
  });
}

export async function updateDay(_prev: RoutineActionState, formData: FormData): Promise<RoutineActionState> {
  const parsed = daySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const n = await db.routineDays.update(parsed.data.id, {
    name: parsed.data.name,
    suggestedWeekday: parsed.data.suggestedWeekday,
    notes: parsed.data.notes || null,
  });
  return n ? {} : { error: "Não foi possível salvar o dia. Tente de novo." };
}

/** Leva as prescrições do dia; as sessões ficam, com o vínculo nulo. */
export async function removeDay(formData: FormData) {
  const parsed = routineIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const diaId = parsed.data.id;

  await db.transaction("rw", [db.routineDays, db.routineExercises, db.sessions, db.sessionExercises], async () => {
    const prescricoes = await db.routineExercises.where("routineDayId").equals(diaId).primaryKeys();
    await db.sessionExercises.where("routineExerciseId").anyOf(prescricoes).modify({ routineExerciseId: null });
    await db.sessions.where("routineDayId").equals(diaId).modify({ routineDayId: null });
    await db.routineExercises.bulkDelete(prescricoes);
    await db.routineDays.delete(diaId);
  });
}

/** Grava a ordem inteira de uma vez, como o upsert único da versão com banco. */
export async function reorderDays(formData: FormData) {
  const parsed = reorderSchema.safeParse({ ids: formData.getAll("ids").map(String) });
  if (!parsed.success) return;

  await db.transaction("rw", db.routineDays, async () => {
    for (const [posicao, id] of parsed.data.ids.entries()) await db.routineDays.update(id, { position: posicao });
  });
}

/* ------------------------------------------------------------------ *
 * Prescrições
 * ------------------------------------------------------------------ */

export async function addExercise(
  _prev: RoutineActionState,
  formData: FormData,
): Promise<RoutineActionState> {
  const parsed = addExerciseSchema.safeParse(Object.fromEntries(formData));
  // Antes saía calado aqui, e o botão parecia morto quando o Zod barrava.
  if (!parsed.success) return { error: "Exercício inválido." };

  const exercicio = await findExercise(parsed.data.exerciseId);
  if (!exercicio) return { error: "Exercício não encontrado neste aparelho." };

  try {
    await db.transaction("rw", db.routineExercises, async () => {
      const existentes = await db.routineExercises
        .where("routineDayId")
        .equals(parsed.data.routineDayId)
        .toArray();
      const proxima = existentes.length === 0 ? 0 : Math.max(...existentes.map((e) => e.position)) + 1;
      await db.routineExercises.add({
        id: newId(),
        routineDayId: parsed.data.routineDayId,
        exerciseId: exercicio.id,
        position: proxima,
        targetSets: PRESCRICAO_PADRAO.targetSets,
        repMin: PRESCRICAO_PADRAO.repMin,
        repMax: PRESCRICAO_PADRAO.repMax,
        targetRir: PRESCRICAO_PADRAO.targetRir,
        restSeconds: exercicio.defaultRestSeconds,
        loadStepKgOverride: null,
        supersetGroup: null,
        notes: null,
      });
    });
  } catch {
    return { error: ERRO_GRAVAR };
  }

  return {};
}

export async function updatePrescription(
  _prev: RoutineActionState,
  formData: FormData,
): Promise<RoutineActionState> {
  const parsed = prescriptionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const n = await db.routineExercises.update(parsed.data.id, {
    targetSets: parsed.data.targetSets,
    repMin: parsed.data.repMin,
    repMax: parsed.data.repMax,
    targetRir: parsed.data.targetRir,
    restSeconds: parsed.data.restSeconds,
    loadStepKgOverride: parsed.data.loadStepKgOverride === null ? null : toKg(parsed.data.loadStepKgOverride),
    notes: parsed.data.notes || null,
  });
  return n ? {} : { error: "Não foi possível salvar a prescrição. Tente de novo." };
}

export async function removeExercise(formData: FormData) {
  const parsed = routineIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const id = parsed.data.id;

  await db.transaction("rw", db.routineExercises, db.sessionExercises, async () => {
    await db.sessionExercises.where("routineExerciseId").equals(id).modify({ routineExerciseId: null });
    await db.routineExercises.delete(id);
  });
}

export async function reorderExercises(formData: FormData) {
  const parsed = reorderSchema.safeParse({ ids: formData.getAll("ids").map(String) });
  if (!parsed.success) return;

  await db.transaction("rw", db.routineExercises, async () => {
    for (const [posicao, id] of parsed.data.ids.entries()) {
      await db.routineExercises.update(id, { position: posicao });
    }
  });
}
