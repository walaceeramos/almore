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

/**
 * Uma sessão concluída com aquele exercício: a prescrição que valia nela e
 * as séries. É a entrada da progressão e da estagnação.
 */
export type PastExerciseSession = {
  date: Date;
  targetSets: number | null;
  repMin: number | null;
  repMax: number | null;
  targetRir: number | null;
  sets: { setNumber: number; kind: SetKind; weightKg: number | null; reps: number; rir: number | null }[];
};

export type RecordKind = "carga_maxima" | "melhor_serie" | "volume_serie" | "volume_sessao";

export type PersonalRecordView = {
  exerciseId: string;
  exerciseName: string;
  kind: RecordKind;
  value: number;
  weightKg: number;
  reps: number;
  sessionId: string;
  achievedAt: Date;
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

type HistoryRow = {
  exercise_id: string;
  target_sets: number | null;
  rep_min: number | null;
  rep_max: number | null;
  target_rir: number | null;
  sets: { set_number: number; kind: SetKind; weight_kg: string | null; reps: number; rir: number | null }[] | null;
  workout_sessions: { started_at: string } | null;
};

/** Quantas sessões por exercício: a estagnação precisa de quatro. */
const HISTORY_PER_EXERCISE = 4;

/**
 * Para cada exercício, as últimas sessões concluídas em que ele teve
 * alguma série, da mais recente para a mais antiga. Alimenta a "última
 * vez", a progressão e a estagnação.
 *
 * Uma consulta só, em vez de uma por exercício. O teto de linhas cobre com
 * folga as últimas dezenas de sessões, que é onde as quatro mais recentes
 * de qualquer exercício em uso estão.
 */
export async function getRecentHistory(
  sessionId: string,
  exerciseIds: string[],
): Promise<Record<string, PastExerciseSession[]>> {
  if (exerciseIds.length === 0) return {};
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("session_exercises")
    .select(
      `exercise_id, target_sets, rep_min, rep_max, target_rir,
       sets ( set_number, kind, weight_kg, reps, rir ),
       workout_sessions!inner ( started_at, status )`,
    )
    .in("exercise_id", exerciseIds)
    .neq("session_id", sessionId)
    .eq("workout_sessions.status", "concluida")
    .order("created_at", { ascending: false })
    .limit(400);

  if (error || !data) return {};

  const resultado: Record<string, PastExerciseSession[]> = {};
  for (const row of data as unknown as HistoryRow[]) {
    const lista = (resultado[row.exercise_id] ??= []);
    if (lista.length >= HISTORY_PER_EXERCISE) continue;
    const series = row.sets ?? [];
    if (series.length === 0 || !row.workout_sessions) continue;

    lista.push({
      date: new Date(row.workout_sessions.started_at),
      targetSets: row.target_sets,
      repMin: row.rep_min,
      repMax: row.rep_max,
      targetRir: row.target_rir,
      sets: series
        .map((s) => ({
          setNumber: s.set_number,
          kind: s.kind,
          weightKg: s.weight_kg === null ? null : Number(s.weight_kg),
          reps: s.reps,
          rir: s.rir,
        }))
        .sort((a, b) => a.setNumber - b.setNumber),
    });
  }
  return resultado;
}

/* ------------------------------------------------------------------ *
 * Histórico
 * ------------------------------------------------------------------ */

export type HistoryItem = {
  id: string;
  title: string;
  routineId: string | null;
  startedAt: Date;
  finishedAt: Date;
  exerciseCount: number;
  sets: { kind: SetKind; weightKg: string | null; reps: number }[];
};

type HistoryListRow = {
  id: string;
  title_snapshot: string;
  routine_id: string | null;
  started_at: string;
  finished_at: string;
  session_exercises: { sets: { kind: SetKind; weight_kg: string | null; reps: number }[] | null }[] | null;
};

/**
 * Treinos concluídos que começaram no intervalo, do mais recente para o
 * mais antigo. O intervalo chega com folga de um dia de cada lado; o
 * recorte exato do mês, no fuso do usuário, fica com a página.
 */
export async function listFinishedBetween(
  from: Date,
  to: Date,
  routineId?: string,
): Promise<HistoryItem[]> {
  const supabase = await createClient();

  let consulta = supabase
    .from("workout_sessions")
    .select("id, title_snapshot, routine_id, started_at, finished_at, session_exercises ( sets ( kind, weight_kg, reps ) )")
    .eq("status", "concluida")
    .gte("started_at", from.toISOString())
    .lt("started_at", to.toISOString())
    .order("started_at", { ascending: false });

  if (routineId) consulta = consulta.eq("routine_id", routineId);

  const { data, error } = await consulta;
  if (error || !data) return [];

  return (data as unknown as HistoryListRow[]).map((r) => {
    const exercicios = r.session_exercises ?? [];
    return {
      id: r.id,
      title: r.title_snapshot,
      routineId: r.routine_id,
      startedAt: new Date(r.started_at),
      finishedAt: new Date(r.finished_at),
      // Exercício que ficou sem série não foi feito.
      exerciseCount: exercicios.filter((e) => (e.sets ?? []).length > 0).length,
      sets: exercicios.flatMap((e) =>
        (e.sets ?? []).map((s) => ({ kind: s.kind, weightKg: s.weight_kg, reps: s.reps })),
      ),
    };
  });
}

/* ------------------------------------------------------------------ *
 * Recordes
 * ------------------------------------------------------------------ */

type RecordRow = {
  exercise_id: string;
  kind: RecordKind;
  value: string;
  weight_kg: string;
  reps: number;
  session_id: string;
  achieved_at: string;
  exercises: { name: string } | null;
};

const RECORD_SELECT = "exercise_id, kind, value, weight_kg, reps, session_id, achieved_at, exercises ( name )";

function toRecord(row: RecordRow): PersonalRecordView {
  return {
    exerciseId: row.exercise_id,
    exerciseName: row.exercises?.name ?? "",
    kind: row.kind,
    value: Number(row.value),
    weightKg: Number(row.weight_kg),
    reps: row.reps,
    sessionId: row.session_id,
    achievedAt: new Date(row.achieved_at),
  };
}

/** Recordes atuais dos exercícios informados. Vazio para quem nunca treinou. */
export async function listRecords(exerciseIds: string[]): Promise<PersonalRecordView[]> {
  if (exerciseIds.length === 0) return [];
  const supabase = await createClient();

  const { data, error } = await supabase.from("personal_records").select(RECORD_SELECT).in("exercise_id", exerciseIds);
  if (error || !data) return [];
  return (data as unknown as RecordRow[]).map(toRecord);
}

/** Recordes que ainda pertencem a esta sessão: os que ela bateu e ninguém superou. */
export async function listSessionRecords(sessionId: string): Promise<PersonalRecordView[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.from("personal_records").select(RECORD_SELECT).eq("session_id", sessionId);
  if (error || !data) return [];
  return (data as unknown as RecordRow[]).map(toRecord);
}

/* ------------------------------------------------------------------ *
 * Volume da semana
 * ------------------------------------------------------------------ */

export type FinishedSetEntry = {
  finishedAt: Date;
  exerciseId: string;
  kind: SetKind;
};

export type MuscleInfo = { id: string; name: string; contribution: number };

type VolumeRow = {
  finished_at: string;
  session_exercises: { exercise_id: string; sets: { kind: SetKind }[] | null }[] | null;
};

type MuscleRow = {
  exercise_id: string;
  contribution: string;
  muscles: { id: string; name: string } | null;
};

/**
 * Séries das sessões concluídas a partir de um instante, mais os músculos
 * de cada exercício envolvido. O recorte exato da semana, no fuso do
 * usuário, e a soma por músculo ficam com quem chama.
 */
export async function listFinishedSetsSince(
  since: Date,
): Promise<{ sets: FinishedSetEntry[]; muscles: Record<string, MuscleInfo[]> }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workout_sessions")
    .select("finished_at, session_exercises ( exercise_id, sets ( kind ) )")
    .eq("status", "concluida")
    .gte("finished_at", since.toISOString());

  if (error || !data) return { sets: [], muscles: {} };

  const sets: FinishedSetEntry[] = [];
  for (const s of data as unknown as VolumeRow[]) {
    const finishedAt = new Date(s.finished_at);
    for (const e of s.session_exercises ?? []) {
      for (const set of e.sets ?? []) sets.push({ finishedAt, exerciseId: e.exercise_id, kind: set.kind });
    }
  }

  const ids = [...new Set(sets.map((s) => s.exerciseId))];
  if (ids.length === 0) return { sets, muscles: {} };

  const { data: vinculos } = await supabase
    .from("exercise_muscles")
    .select("exercise_id, contribution, muscles ( id, name )")
    .in("exercise_id", ids);

  const muscles: Record<string, MuscleInfo[]> = {};
  for (const v of (vinculos ?? []) as unknown as MuscleRow[]) {
    if (!v.muscles) continue;
    (muscles[v.exercise_id] ??= []).push({
      id: v.muscles.id,
      name: v.muscles.name,
      contribution: Number(v.contribution),
    });
  }
  return { sets, muscles };
}
