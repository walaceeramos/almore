import { db } from "@/core/data/db";
import { exerciseMap } from "@/core/data/exercises";
import type { SessionExercise, WorkoutSession, WorkoutSet } from "@/core/data/types";

/* ------------------------------------------------------------------ *
 * Formas que as telas consomem
 * ------------------------------------------------------------------ */

export type SetKind = "aquecimento" | "trabalho";
export type SessionStatus = "em_andamento" | "concluida";
export type RecordKind = "carga_maxima" | "melhor_serie" | "volume_serie" | "volume_sessao";

export type SessionSet = {
  id: string;
  setNumber: number;
  kind: SetKind;
  /** Nulo = só o peso do corpo. */
  weightKg: number | null;
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

export type OpenSession = { id: string; title: string; startedAt: Date };

/** Uma sessão concluída com aquele exercício: a prescrição que valia nela e as séries. */
export type PastExerciseSession = {
  date: Date;
  targetSets: number | null;
  repMin: number | null;
  repMax: number | null;
  targetRir: number | null;
  sets: { setNumber: number; kind: SetKind; weightKg: number | null; reps: number; rir: number | null }[];
};

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
 * Auxiliares
 * ------------------------------------------------------------------ */

/** Desempata por id porque `position` e `setNumber` não são únicos. */
function byPosition<T extends { position: number; id: string }>(a: T, b: T): number {
  return a.position - b.position || a.id.localeCompare(b.id);
}

function bySetNumber(a: WorkoutSet, b: WorkoutSet): number {
  return a.setNumber - b.setNumber || a.completedAt.localeCompare(b.completedAt);
}

function toSet(s: WorkoutSet): SessionSet {
  return {
    id: s.id,
    setNumber: s.setNumber,
    kind: s.kind,
    weightKg: s.weightKg,
    reps: s.reps,
    rir: s.rir,
    completedAt: new Date(s.completedAt),
  };
}

/** Séries agrupadas pelo exercício da sessão, já em ordem. */
async function setsBySessionExercise(ids: string[]): Promise<Map<string, WorkoutSet[]>> {
  const series = ids.length ? await db.sets.where("sessionExerciseId").anyOf(ids).toArray() : [];
  const mapa = new Map<string, WorkoutSet[]>();
  for (const s of series) mapa.set(s.sessionExerciseId, [...(mapa.get(s.sessionExerciseId) ?? []), s]);
  for (const lista of mapa.values()) lista.sort(bySetNumber);
  return mapa;
}

async function finishedSessions(): Promise<WorkoutSession[]> {
  return db.sessions.where("status").equals("concluida").toArray();
}

/* ------------------------------------------------------------------ *
 * Sessão
 * ------------------------------------------------------------------ */

/** Sessão inteira, com exercícios e séries. Serve a execução, o resumo e o histórico. */
export async function getSession(id: string): Promise<SessionDetail | null> {
  const s = await db.sessions.get(id);
  if (!s) return null;

  const exerciciosDaSessao = await db.sessionExercises.where("sessionId").equals(id).toArray();
  const [series, exercicios] = await Promise.all([
    setsBySessionExercise(exerciciosDaSessao.map((e) => e.id)),
    exerciseMap(),
  ]);

  return {
    id: s.id,
    title: s.titleSnapshot,
    status: s.status,
    routineId: s.routineId,
    routineDayId: s.routineDayId,
    startedAt: new Date(s.startedAt),
    finishedAt: s.finishedAt ? new Date(s.finishedAt) : null,
    perceivedEffort: s.perceivedEffort,
    notes: s.notes,
    exercises: exerciciosDaSessao
      .flatMap((e) => {
        const ex = exercicios.get(e.exerciseId);
        if (!ex) return [];
        return [
          {
            id: e.id,
            position: e.position,
            exerciseId: e.exerciseId,
            exerciseName: ex.name,
            equipment: ex.equipment,
            targetSets: e.targetSets,
            repMin: e.repMin,
            repMax: e.repMax,
            targetRir: e.targetRir,
            restSeconds: e.restSeconds,
            loadStepKg: e.loadStepKg,
            notes: e.notes,
            sets: (series.get(e.id) ?? []).map(toSet),
          },
        ];
      })
      .sort(byPosition),
  };
}

/** A sessão em andamento, se houver. A camada de dados garante no máximo uma. */
export async function getOpenSession(): Promise<OpenSession | null> {
  const s = await db.sessions.where("status").equals("em_andamento").first();
  return s ? { id: s.id, title: s.titleSnapshot, startedAt: new Date(s.startedAt) } : null;
}

/** O dia treinado por último naquele programa, para propor o seguinte. */
export async function getLastTrainedDayId(routineId: string): Promise<string | null> {
  const sessoes = await db.sessions.where("routineId").equals(routineId).toArray();
  const ultima = sessoes
    .filter((s) => s.status === "concluida" && s.routineDayId !== null)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  return ultima?.routineDayId ?? null;
}

/** Datas de conclusão a partir de um instante. Serve a semana e a sequência. */
export async function listFinishedSince(since: Date): Promise<Date[]> {
  const limite = since.toISOString();
  return (await finishedSessions())
    .filter((s) => s.finishedAt !== null && s.finishedAt >= limite)
    .map((s) => new Date(s.finishedAt as string));
}

/* ------------------------------------------------------------------ *
 * Histórico por exercício
 * ------------------------------------------------------------------ */

/** Quantas sessões por exercício: a estagnação precisa de quatro. */
const HISTORY_PER_EXERCISE = 4;

/**
 * Para cada exercício, as últimas sessões concluídas em que ele teve
 * alguma série, da mais recente para a mais antiga. Alimenta a "última
 * vez", a progressão e a estagnação.
 */
export async function getRecentHistory(
  sessionId: string,
  exerciseIds: string[],
): Promise<Record<string, PastExerciseSession[]>> {
  if (exerciseIds.length === 0) return {};

  const [linhas, sessoes] = await Promise.all([
    db.sessionExercises.where("exerciseId").anyOf(exerciseIds).toArray(),
    finishedSessions(),
  ]);
  const concluidas = new Map(sessoes.filter((s) => s.id !== sessionId).map((s) => [s.id, s]));
  const validas = linhas.filter((l) => concluidas.has(l.sessionId));
  const series = await setsBySessionExercise(validas.map((l) => l.id));

  const resultado: Record<string, PastExerciseSession[]> = {};
  const ordenadas = validas.sort((a, b) =>
    (concluidas.get(b.sessionId)?.startedAt ?? "").localeCompare(concluidas.get(a.sessionId)?.startedAt ?? ""),
  );
  for (const l of ordenadas) {
    const lista = (resultado[l.exerciseId] ??= []);
    if (lista.length >= HISTORY_PER_EXERCISE) continue;
    const doExercicio = series.get(l.id) ?? [];
    const sessao = concluidas.get(l.sessionId);
    if (doExercicio.length === 0 || !sessao) continue;

    lista.push({
      date: new Date(sessao.startedAt),
      targetSets: l.targetSets,
      repMin: l.repMin,
      repMax: l.repMax,
      targetRir: l.targetRir,
      sets: doExercicio.map((s) => ({
        setNumber: s.setNumber,
        kind: s.kind,
        weightKg: s.weightKg,
        reps: s.reps,
        rir: s.rir,
      })),
    });
  }
  return resultado;
}

/* ------------------------------------------------------------------ *
 * Histórico de sessões
 * ------------------------------------------------------------------ */

export type HistoryItem = {
  id: string;
  title: string;
  routineId: string | null;
  startedAt: Date;
  finishedAt: Date;
  exerciseCount: number;
  sets: { kind: SetKind; weightKg: number | null; reps: number }[];
};

/** Treinos concluídos que começaram no intervalo, do mais recente para o mais antigo. */
export async function listFinishedBetween(from: Date, to: Date, routineId?: string): Promise<HistoryItem[]> {
  const de = from.toISOString();
  const ate = to.toISOString();
  const sessoes = (await finishedSessions())
    .filter((s) => s.startedAt >= de && s.startedAt < ate && (!routineId || s.routineId === routineId))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  if (sessoes.length === 0) return [];

  const exercicios = await db.sessionExercises
    .where("sessionId")
    .anyOf(sessoes.map((s) => s.id))
    .toArray();
  const series = await setsBySessionExercise(exercicios.map((e) => e.id));

  const porSessao = new Map<string, SessionExercise[]>();
  for (const e of exercicios) porSessao.set(e.sessionId, [...(porSessao.get(e.sessionId) ?? []), e]);

  return sessoes.map((s) => {
    const doTreino = porSessao.get(s.id) ?? [];
    return {
      id: s.id,
      title: s.titleSnapshot,
      routineId: s.routineId,
      startedAt: new Date(s.startedAt),
      finishedAt: new Date(s.finishedAt as string),
      // Exercício que ficou sem série não foi feito.
      exerciseCount: doTreino.filter((e) => (series.get(e.id) ?? []).length > 0).length,
      sets: doTreino.flatMap((e) =>
        (series.get(e.id) ?? []).map((x) => ({ kind: x.kind, weightKg: x.weightKg, reps: x.reps })),
      ),
    };
  });
}

/* ------------------------------------------------------------------ *
 * Recordes
 * ------------------------------------------------------------------ */

async function toRecordViews(
  linhas: { exerciseId: string; kind: RecordKind; value: number; weightKg: number; reps: number; sessionId: string; achievedAt: string }[],
): Promise<PersonalRecordView[]> {
  const exercicios = await exerciseMap();
  return linhas.map((r) => ({
    exerciseId: r.exerciseId,
    exerciseName: exercicios.get(r.exerciseId)?.name ?? "",
    kind: r.kind,
    value: r.value,
    weightKg: r.weightKg,
    reps: r.reps,
    sessionId: r.sessionId,
    achievedAt: new Date(r.achievedAt),
  }));
}

/** Recordes atuais dos exercícios informados. */
export async function listRecords(exerciseIds: string[]): Promise<PersonalRecordView[]> {
  if (exerciseIds.length === 0) return [];
  return toRecordViews(await db.personalRecords.where("exerciseId").anyOf(exerciseIds).toArray());
}

/** Recordes que ainda pertencem a esta sessão: os que ela bateu e ninguém superou. */
export async function listSessionRecords(sessionId: string): Promise<PersonalRecordView[]> {
  return toRecordViews(await db.personalRecords.where("sessionId").equals(sessionId).toArray());
}

/* ------------------------------------------------------------------ *
 * Volume da semana
 * ------------------------------------------------------------------ */

export type FinishedSetEntry = { finishedAt: Date; exerciseId: string; kind: SetKind };
export type MuscleInfo = { id: string; contribution: number };

/**
 * Séries das sessões concluídas a partir de um instante, mais os músculos
 * de cada exercício envolvido. Primário conta 1, secundário 0,5 — a mesma
 * contribuição que o seed gravava em exercise_muscles.
 */
export async function listFinishedSetsSince(
  since: Date,
): Promise<{ sets: FinishedSetEntry[]; muscles: Record<string, MuscleInfo[]> }> {
  const limite = since.toISOString();
  const sessoes = (await finishedSessions()).filter((s) => s.finishedAt !== null && s.finishedAt >= limite);
  if (sessoes.length === 0) return { sets: [], muscles: {} };

  const fim = new Map(sessoes.map((s) => [s.id, new Date(s.finishedAt as string)]));
  const exerciciosDaSessao = await db.sessionExercises.where("sessionId").anyOf([...fim.keys()]).toArray();
  const series = await setsBySessionExercise(exerciciosDaSessao.map((e) => e.id));

  const sets: FinishedSetEntry[] = exerciciosDaSessao.flatMap((e) =>
    (series.get(e.id) ?? []).map((s) => ({
      finishedAt: fim.get(e.sessionId) as Date,
      exerciseId: e.exerciseId,
      kind: s.kind,
    })),
  );

  const exercicios = await exerciseMap();
  const muscles: Record<string, MuscleInfo[]> = {};
  for (const id of new Set(sets.map((s) => s.exerciseId))) {
    muscles[id] = (exercicios.get(id)?.muscles ?? []).map((m) => ({
      id: m.muscleId,
      contribution: m.role === "primario" ? 1 : 0.5,
    }));
  }
  return { sets, muscles };
}
