import Dexie, { type EntityTable } from "dexie";
import type {
  CustomExercise,
  Meta,
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

/** Nome do banco. O anterior, de quando o app se chamava Almore. */
const DB_NAME = "seriepro";
const DB_ANTERIOR = "almore";

/** Marca, dentro do próprio banco, que os dados já vieram do antigo. */
const MARCA_MIGRACAO = "migrated-from-almore";

export class SerieProDb extends Dexie {
  profile!: EntityTable<Profile, "id">;
  customExercises!: EntityTable<CustomExercise, "id">;
  routines!: EntityTable<Routine, "id">;
  routineDays!: EntityTable<RoutineDay, "id">;
  routineExercises!: EntityTable<RoutineExercise, "id">;
  sessions!: EntityTable<WorkoutSession, "id">;
  sessionExercises!: EntityTable<SessionExercise, "id">;
  sets!: EntityTable<WorkoutSet, "id">;
  personalRecords!: EntityTable<PersonalRecord, "id">;
  meta!: EntityTable<Meta, "id">;

  constructor(nome: string = DB_NAME) {
    super(nome);
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
      meta: "id",
    });
  }
}

export const db = new SerieProDb();

/** Tabelas de dados do usuário, na ordem do backup. `meta` fica de fora. */
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
 * Traz os dados do banco antigo, de quando o app se chamava Almore.
 *
 * Renomear um banco de IndexedDB não existe: um nome novo é um banco novo
 * e vazio. Sem esta cópia, quem já usava o app abriria o SériePro sem
 * nenhum programa, treino ou recorde — tudo continuaria no disco, sob o
 * nome antigo, inalcançável.
 *
 * Roda uma vez por aparelho, antes da primeira leitura, e **não apaga o
 * banco antigo**: ele fica como rede de segurança, já que o aparelho é a
 * única cópia dos dados. A marca em `meta` impede repetir a cópia — sem
 * ela, apagar tudo dentro do app faria os dados antigos ressuscitarem na
 * abertura seguinte.
 *
 * Exportada para o teste: é o caminho mais arriscado do app, porque o
 * aparelho é a única cópia dos dados.
 */
export async function migraDoBancoAnterior(destino: SerieProDb): Promise<void> {
  if (await destino.meta.get(MARCA_MIGRACAO)) return;
  if (!(await Dexie.exists(DB_ANTERIOR))) {
    // Aparelho novo: nada a trazer, e marcar evita checar a cada abertura.
    await destino.meta.put({ id: MARCA_MIGRACAO, value: "sem-banco-anterior", at: new Date().toISOString() });
    return;
  }

  const antigo = new SerieProDb(DB_ANTERIOR);
  try {
    await antigo.open();

    for (const tabela of TABLES) {
      // `meta` não existe no banco antigo; TABLES já a exclui.
      const linhas = await antigo.table(tabela).toArray();
      if (linhas.length > 0) await destino.table(tabela).bulkPut(linhas);
    }

    await destino.meta.put({ id: MARCA_MIGRACAO, value: DB_ANTERIOR, at: new Date().toISOString() });
  } finally {
    antigo.close();
  }
}

/**
 * `on("ready")` roda antes de qualquer operação enfileirada, e o Dexie
 * espera a promessa. É o único ponto em que a cópia acontece com certeza
 * antes da primeira leitura de tela.
 */
db.on("ready", async () => {
  await migraDoBancoAnterior(db);
});

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
