import { db } from "@/core/data/db";
import { exerciseMap } from "@/core/data/exercises";
import type { Routine, RoutineDay, RoutineExercise } from "@/core/data/types";
import { resolveLoadStep } from "@/core/domain/load-step";

/* ------------------------------------------------------------------ *
 * Formas que as telas consomem
 * ------------------------------------------------------------------ */

export type RoutineSummary = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  archivedAt: Date | null;
  dayCount: number;
  exerciseCount: number;
};

export type PrescribedExercise = {
  id: string;
  position: number;
  targetSets: number;
  repMin: number;
  repMax: number;
  targetRir: number | null;
  restSeconds: number;
  /** Como está guardado: nulo significa herdar do exercício. */
  loadStepKgOverride: number | null;
  supersetGroup: string | null;
  notes: string | null;
  exerciseId: string;
  exerciseName: string;
  equipment: string;
  /** Override se houver, senão o do exercício. Já resolvido. */
  loadStepKg: number;
};

export type RoutineDayDetail = {
  id: string;
  name: string;
  position: number;
  suggestedWeekday: number | null;
  notes: string | null;
  exercises: PrescribedExercise[];
};

export type RoutineDetail = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  archivedAt: Date | null;
  days: RoutineDayDetail[];
};

/** Desempata por id porque `position` não é único (ver comentário na 0005). */
export function byPosition<T extends { position: number; id: string }>(a: T, b: T): number {
  return a.position - b.position || a.id.localeCompare(b.id);
}

/* ------------------------------------------------------------------ *
 * Consultas
 * ------------------------------------------------------------------ */

/** Ativo primeiro, depois do mais novo para o mais antigo. */
export async function listRoutines(): Promise<RoutineSummary[]> {
  const [rotinas, dias, prescricoes] = await Promise.all([
    db.routines.toArray(),
    db.routineDays.toArray(),
    db.routineExercises.toArray(),
  ]);

  const diaParaRotina = new Map(dias.map((d) => [d.id, d.routineId]));
  const diasPorRotina = new Map<string, number>();
  const exerciciosPorRotina = new Map<string, number>();
  for (const d of dias) diasPorRotina.set(d.routineId, (diasPorRotina.get(d.routineId) ?? 0) + 1);
  for (const p of prescricoes) {
    const r = diaParaRotina.get(p.routineDayId);
    if (r) exerciciosPorRotina.set(r, (exerciciosPorRotina.get(r) ?? 0) + 1);
  }

  return rotinas
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.createdAt.localeCompare(a.createdAt))
    .map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isActive: r.isActive,
      archivedAt: r.archivedAt ? new Date(r.archivedAt) : null,
      dayCount: diasPorRotina.get(r.id) ?? 0,
      exerciseCount: exerciciosPorRotina.get(r.id) ?? 0,
    }));
}

async function toDetail(r: Routine): Promise<RoutineDetail> {
  const dias = await db.routineDays.where("routineId").equals(r.id).toArray();
  const prescricoes = dias.length
    ? await db.routineExercises.where("routineDayId").anyOf(dias.map((d) => d.id)).toArray()
    : [];
  const exercicios = await exerciseMap();

  const porDia = new Map<string, RoutineExercise[]>();
  for (const p of prescricoes) porDia.set(p.routineDayId, [...(porDia.get(p.routineDayId) ?? []), p]);

  const toDay = (d: RoutineDay): RoutineDayDetail => ({
    id: d.id,
    name: d.name,
    position: d.position,
    suggestedWeekday: d.suggestedWeekday,
    notes: d.notes,
    exercises: (porDia.get(d.id) ?? [])
      .flatMap((p) => {
        const ex = exercicios.get(p.exerciseId);
        // Sem o exercício não há o que prescrever. Não deveria acontecer:
        // exercício com prescrição nunca é apagado, só arquivado.
        if (!ex) return [];
        return [
          {
            id: p.id,
            position: p.position,
            targetSets: p.targetSets,
            repMin: p.repMin,
            repMax: p.repMax,
            targetRir: p.targetRir,
            restSeconds: p.restSeconds,
            loadStepKgOverride: p.loadStepKgOverride,
            supersetGroup: p.supersetGroup,
            notes: p.notes,
            exerciseId: ex.id,
            exerciseName: ex.name,
            equipment: ex.equipment,
            loadStepKg: resolveLoadStep(p.loadStepKgOverride, ex.loadStepKg),
          },
        ];
      })
      .sort(byPosition),
  });

  return {
    id: r.id,
    name: r.name,
    description: r.description,
    isActive: r.isActive,
    archivedAt: r.archivedAt ? new Date(r.archivedAt) : null,
    days: dias.map(toDay).sort(byPosition),
  };
}

/** Programa inteiro, com dias e prescrições. Serve o detalhe e o editor. */
export async function getRoutine(id: string): Promise<RoutineDetail | null> {
  const r = await db.routines.get(id);
  return r ? toDetail(r) : null;
}

/** Usada pelo início para saber qual programa vale hoje. */
export async function getActiveRoutine(): Promise<RoutineDetail | null> {
  const r = (await db.routines.toArray()).find((x) => x.isActive && x.archivedAt === null);
  return r ? toDetail(r) : null;
}
