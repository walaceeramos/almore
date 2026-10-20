import Dexie, { type EntityTable } from "dexie";
import type {
  CustomExercise,
  PersonalRecord,
  Profile,
  Routine,
  RoutineDay,
  RoutineExercise,
  SessionExercise,
  WorkoutSession,
  WorkoutSet,
} from "./types";

/**
 * Banco no aparelho (IndexedDB, via Dexie).
 *
 * Substitui o Supabase enquanto o usuário decide o banco definitivo. As
 * garantias que o Postgres dava sozinho — chave estrangeira, RESTRICT,
 * índice único parcial, CHECK — passam a ser da camada de dados
 * (`features/*\/actions.ts`), sempre dentro de `db.transaction`, que aqui
 * é atômica de verdade.
 *
 * Só existe no navegador. Quem importa este módulo é componente cliente.
 *
 * Mudar o esquema: suba a versão e descreva só as tabelas que mudaram.
 * Nunca altere uma versão já publicada — é o equivalente a editar uma
 * migration aplicada.
 */
export class AlmoreDb extends Dexie {
  profile!: EntityTable<Profile, "id">;
  customExercises!: EntityTable<CustomExercise, "id">;
  routines!: EntityTable<Routine, "id">;
  routineDays!: EntityTable<RoutineDay, "id">;
  routineExercises!: EntityTable<RoutineExercise, "id">;
  sessions!: EntityTable<WorkoutSession, "id">;
  sessionExercises!: EntityTable<SessionExercise, "id">;
  sets!: EntityTable<WorkoutSet, "id">;
  personalRecords!: EntityTable<PersonalRecord, "id">;

  constructor() {
    super("almore");
    // Só os campos usados em consulta entram no índice; o resto é guardado igual.
    this.version(1).stores({
      profile: "id",
      customExercises: "id",
      routines: "id",
      routineDays: "id, routineId",
      routineExercises: "id, routineDayId, exerciseId",
      sessions: "id, status, routineId, routineDayId, startedAt",
      sessionExercises: "id, sessionId, exerciseId, routineExerciseId",
      sets: "id, sessionExerciseId",
      personalRecords: "id, exerciseId, sessionId, setId",
    });
  }
}

export const db = new AlmoreDb();

/** Todas as tabelas, na ordem do backup. */
export const TABLES = [
  "profile",
  "customExercises",
  "routines",
  "routineDays",
  "routineExercises",
  "sessions",
  "sessionExercises",
  "sets",
  "personalRecords",
] as const;

export type TableName = (typeof TABLES)[number];

/**
 * Pede ao navegador para não apagar os dados sozinho quando faltar espaço.
 * Sem banco, esta é a única cópia. O navegador pode recusar; o backup em
 * arquivo (Ajustes) continua sendo a proteção real.
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
