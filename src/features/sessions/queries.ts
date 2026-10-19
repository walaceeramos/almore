import { createClient } from "@/core/auth/server";

/* ------------------------------------------------------------------ *
 * Formas que as telas consomem
 * ------------------------------------------------------------------ */

export type SetKind = "aquecimento" | "trabalho";
export type SessionStatus = "em_andamento" | "concluida";

export type SessionSet = {
  id: string;
  setNumber: number;
  kind: SetKind;
  /** Como veio do banco ("82.50"); nulo = só o peso do corpo. */
  weightKg: string | null;
  reps: number;
  rir: number | null;
  completedAt: Date;
};

export type SessionExerciseDetail = {
  id: string;
  position: number;
  exerciseId: string;
  exerciseName: string;
  equipment: string;
  /** Snapshot da prescrição. Nulos juntos quando acrescentado na hora. */
  targetSets: number | null;
  repMin: number | null;
  repMax: number | null;
  targetRir: number | null;
  restSeconds: number;
  loadStepKg: number;
  notes: string | null;
  sets: SessionSet[];
};

export type SessionDetail = {
  id: string;
  title: string;
  status: SessionStatus;
  routineId: string | null;
  routineDayId: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  perceivedEffort: number | null;
  notes: string | null;
  exercises: SessionExerciseDetail[];
};

export type OpenSession = {
  id: string;
  title: string;
  startedAt: Date;
};

/** O que foi feito na última sessão concluída com aquele exercício. */
export type PreviousPerformance = {
  date: Date;
  sets: { setNumber: number; kind: SetKind; weightKg: string | null; reps: number }[];
};

/* ------------------------------------------------------------------ *
 * Linhas cruas
 *
 * O Postgres devolve snake_case e o tipo do Drizzle é camelCase. A
 * conversão é explícita na borda, como manda o invariante.
 * ------------------------------------------------------------------ */

type SetRow = {
  id: string;
  set_number: number;
  kind: SetKind;
  weight_kg: string | null;
  reps: number;
  rir: number | null;
  completed_at: string;
};

type SessionExerciseRow = {
  id: string;
  position: number;
  target_sets: number | null;
  rep_min: number | null;
  rep_max: number | null;
  target_rir: number | null;
  rest_seconds: number;
  load_step_kg: string;
  notes: string | null;
  exercises: { id: string; name: string; equipment: string } | null;
  sets: SetRow[] | null;
};

type SessionRow = {
  id: string;
  title_snapshot: string;
  status: SessionStatus;
  routine_id: string | null;
  routine_day_id: string | null;
  started_at: string;
  finished_at: string | null;
  perceived_effort: number | null;
  notes: string | null;
  session_exercises: SessionExerciseRow[] | null;
};

const DETAIL_SELECT = `
  id, title_snapshot, status, routine_id, routine_day_id, started_at,
  finished_at, perceived_effort, notes,
  session_exercises (
    id, position, target_sets, rep_min, rep_max, target_rir, rest_seconds,
    load_step_kg, notes,
    exercises ( id, name, equipment ),
    sets ( id, set_number, kind, weight_kg, reps, rir, completed_at )
  )
`;

/** Desempata por id porque `position` e `set_number` não são únicos. */
function byPosition<T extends { position: number; id: string }>(a: T, b: T): number {
  return a.position - b.position || a.id.localeCompare(b.id);
}

function bySetNumber(a: SessionSet, b: SessionSet): number {
  return a.setNumber - b.setNumber || a.completedAt.getTime() - b.completedAt.getTime();
}

function toSet(row: SetRow): SessionSet {
  return {
    id: row.id,
    setNumber: row.set_number,
    kind: row.kind,
    weightKg: row.weight_kg,
    reps: row.reps,
    rir: row.rir,
    completedAt: new Date(row.completed_at),
  };
}

function toSessionExercise(row: SessionExerciseRow): SessionExerciseDetail | null {
  // O RLS de session_exercises exige exercício legível; isto não deveria
  // acontecer, mas sem o exercício não há o que mostrar.
  if (!row.exercises) return null;

  return {
    id: row.id,
    position: row.position,
    exerciseId: row.exercises.id,
    exerciseName: row.exercises.name,
    equipment: row.exercises.equipment,
    targetSets: row.target_sets,
    repMin: row.rep_min,
    repMax: row.rep_max,
    targetRir: row.target_rir,
    restSeconds: row.rest_seconds,
    loadStepKg: Number(row.load_step_kg),
    notes: row.notes,
    sets: (row.sets ?? []).map(toSet).sort(bySetNumber),
  };
}

function toDetail(row: SessionRow): SessionDetail {
  return {
    id: row.id,
    title: row.title_snapshot,
    status: row.status,
    routineId: row.routine_id,
    routineDayId: row.routine_day_id,
    startedAt: new Date(row.started_at),
    finishedAt: row.finished_at ? new Date(row.finished_at) : null,
    perceivedEffort: row.perceived_effort,
    notes: row.notes,
    exercises: (row.session_exercises ?? [])
      .map(toSessionExercise)
      .filter((e): e is SessionExerciseDetail => e !== null)
      .sort(byPosition),
  };
}

/* ------------------------------------------------------------------ *
 * Consultas
 *
 * O RLS limita às sessões do próprio usuário; não há filtro de dono aqui.
 * ------------------------------------------------------------------ */

/** Sessão inteira, com exercícios e séries. Serve a execução e o resumo. */
export async function getSession(id: string): Promise<SessionDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.from("workout_sessions").select(DETAIL_SELECT).eq("id", id).maybeSingle();
  if (error || !data) return null;

  return toDetail(data as unknown as SessionRow);
}

/** A sessão em andamento, se houver. O índice parcial garante no máximo uma. */
export async function getOpenSession(): Promise<OpenSession | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workout_sessions")
    .select("id, title_snapshot, started_at")
    .eq("status", "em_andamento")
    .maybeSingle();

  if (error || !data) return null;

  const row = data as { id: string; title_snapshot: string; started_at: string };
  return { id: row.id, title: row.title_snapshot, startedAt: new Date(row.started_at) };
}

/**
 * O dia do programa treinado por último, para propor o seguinte da
 * sequência. Nulo quando o programa nunca foi treinado.
 */
export async function getLastTrainedDayId(routineId: string): Promise<string | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("workout_sessions")
    .select("routine_day_id")
    .eq("routine_id", routineId)
    .eq("status", "concluida")
    .not("routine_day_id", "is", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as { routine_day_id: string | null } | null)?.routine_day_id ?? null;
}

/** Datas de conclusão a partir de um instante. Serve a contagem da semana. */
export async function listFinishedSince(since: Date): Promise<Date[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workout_sessions")
    .select("finished_at")
    .eq("status", "concluida")
    .gte("finished_at", since.toISOString());

  if (error || !data) return [];
  return (data as { finished_at: string }[]).map((r) => new Date(r.finished_at));
}

type PreviousRow = {
  exercise_id: string;
  sets: { set_number: number; kind: SetKind; weight_kg: string | null; reps: number }[] | null;
  workout_sessions: { started_at: string } | null;
};

/**
 * Para cada exercício, as séries da última sessão concluída em que ele
 * apareceu com alguma série feita. É o que pré-preenche a série seguinte.
 *
 * Uma consulta só, ordenada da mais recente para a mais antiga, em vez de
 * uma por exercício. O teto de linhas cobre com folga as últimas dezenas
 * de sessões, que é onde a última vez de qualquer exercício em uso está.
 */
export async function getPreviousPerformance(
  sessionId: string,
  exerciseIds: string[],
): Promise<Record<string, PreviousPerformance>> {
  if (exerciseIds.length === 0) return {};
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("session_exercises")
    .select("exercise_id, sets ( set_number, kind, weight_kg, reps ), workout_sessions!inner ( started_at, status )")
    .in("exercise_id", exerciseIds)
    .neq("session_id", sessionId)
    .eq("workout_sessions.status", "concluida")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error || !data) return {};

  const resultado: Record<string, PreviousPerformance> = {};
  for (const row of data as unknown as PreviousRow[]) {
    if (resultado[row.exercise_id]) continue;
    const series = row.sets ?? [];
    if (series.length === 0 || !row.workout_sessions) continue;

    resultado[row.exercise_id] = {
      date: new Date(row.workout_sessions.started_at),
      sets: series
        .map((s) => ({ setNumber: s.set_number, kind: s.kind, weightKg: s.weight_kg, reps: s.reps }))
        .sort((a, b) => a.setNumber - b.setNumber),
    };
  }
  return resultado;
}
