import { createClient } from "@/core/auth/server";
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
  /** Como veio do banco: nulo significa herdar do exercício. */
  loadStepKgOverride: string | null;
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

/* ------------------------------------------------------------------ *
 * Linhas cruas
 *
 * O Postgres devolve snake_case e o tipo do Drizzle é camelCase. A
 * conversão é explícita na borda, como manda o invariante: castar direto
 * compila e devolve `undefined` em todo campo.
 * ------------------------------------------------------------------ */

type ExerciseRow = {
  id: string;
  name: string;
  equipment: string;
  load_step_kg: string;
};

type PrescriptionRow = {
  id: string;
  position: number;
  target_sets: number;
  rep_min: number;
  rep_max: number;
  target_rir: number | null;
  rest_seconds: number;
  load_step_kg_override: string | null;
  superset_group: string | null;
  notes: string | null;
  exercises: ExerciseRow | null;
};

type DayRow = {
  id: string;
  name: string;
  position: number;
  suggested_weekday: number | null;
  notes: string | null;
  routine_exercises: PrescriptionRow[] | null;
};

type RoutineRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  archived_at: string | null;
  routine_days: DayRow[] | null;
};

const DETAIL_SELECT = `
  id, name, description, is_active, archived_at,
  routine_days (
    id, name, position, suggested_weekday, notes,
    routine_exercises (
      id, position, target_sets, rep_min, rep_max, target_rir,
      rest_seconds, load_step_kg_override, superset_group, notes,
      exercises ( id, name, equipment, load_step_kg )
    )
  )
`;

/** Desempata por id porque `position` não é único. Ver comentário na 0005. */
function byPosition<T extends { position: number; id: string }>(a: T, b: T): number {
  return a.position - b.position || a.id.localeCompare(b.id);
}

function toPrescription(row: PrescriptionRow): PrescribedExercise | null {
  // Sem o exercício não há o que prescrever. Não deveria acontecer: o RLS
  // de routine_exercises exige que o exercício seja legível.
  if (!row.exercises) return null;

  return {
    id: row.id,
    position: row.position,
    targetSets: row.target_sets,
    repMin: row.rep_min,
    repMax: row.rep_max,
    targetRir: row.target_rir,
    restSeconds: row.rest_seconds,
    loadStepKgOverride: row.load_step_kg_override,
    supersetGroup: row.superset_group,
    notes: row.notes,
    exerciseId: row.exercises.id,
    exerciseName: row.exercises.name,
    equipment: row.exercises.equipment,
    loadStepKg: resolveLoadStep(row.load_step_kg_override, row.exercises.load_step_kg),
  };
}

function toDay(row: DayRow): RoutineDayDetail {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    suggestedWeekday: row.suggested_weekday,
    notes: row.notes,
    exercises: (row.routine_exercises ?? [])
      .map(toPrescription)
      .filter((e): e is PrescribedExercise => e !== null)
      .sort(byPosition),
  };
}

function toDetail(row: RoutineRow): RoutineDetail {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    archivedAt: row.archived_at ? new Date(row.archived_at) : null,
    days: (row.routine_days ?? []).map(toDay).sort(byPosition),
  };
}

/* ------------------------------------------------------------------ *
 * Consultas
 * ------------------------------------------------------------------ */

type SummaryRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  archived_at: string | null;
  routine_days: { id: string; routine_exercises: { id: string }[] | null }[] | null;
};

/**
 * Lista do usuário. O RLS já limita às próprias rotinas; não há filtro de
 * dono aqui porque ele seria redundante — e redundância que o
 * desenvolvedor precisa lembrar não é proteção.
 */
export async function listRoutines(): Promise<RoutineSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("routines")
    .select("id, name, description, is_active, archived_at, routine_days ( id, routine_exercises ( id ) )")
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Falha ao listar programas: ${error.message}`);

  return (data as unknown as SummaryRow[]).map((r) => {
    const dias = r.routine_days ?? [];
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      isActive: r.is_active,
      archivedAt: r.archived_at ? new Date(r.archived_at) : null,
      dayCount: dias.length,
      exerciseCount: dias.reduce((soma, d) => soma + (d.routine_exercises?.length ?? 0), 0),
    };
  });
}

/** Programa inteiro, com dias e prescrições. Serve o detalhe e o editor. */
export async function getRoutine(id: string): Promise<RoutineDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.from("routines").select(DETAIL_SELECT).eq("id", id).maybeSingle();
  if (error || !data) return null;

  return toDetail(data as unknown as RoutineRow);
}

/** Usada pelo dashboard e pelo editor para saber qual programa vale hoje. */
export async function getActiveRoutine(): Promise<RoutineDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("routines")
    .select(DETAIL_SELECT)
    .eq("is_active", true)
    .is("archived_at", null)
    .maybeSingle();

  if (error || !data) return null;

  return toDetail(data as unknown as RoutineRow);
}
