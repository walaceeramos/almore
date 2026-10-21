/**
 * Forma dos dados guardados no aparelho.
 *
 * Espelha o modelo das migrations em `supabase/migrations` (que ficam
 * guardadas para quando houver banco), com duas diferenças de borda:
 * nomes em camelCase e peso como número. Peso é número em JavaScript, mas
 * todo valor gravado passa por `toKg`, que arredonda a centésimos: é o
 * mesmo contrato do `numeric(6,2)`, e as somas do domínio são feitas em
 * centésimos inteiros. Datas são strings ISO 8601.
 *
 * Prescrição e execução continuam separadas: `routine*` é o plano,
 * `session*` e `sets` são o que aconteceu, com snapshot da prescrição.
 */

export type Pattern =
  | "empurrar_horizontal"
  | "empurrar_vertical"
  | "puxar_horizontal"
  | "puxar_vertical"
  | "agachamento"
  | "dobradica_quadril"
  | "extensao_joelho"
  | "flexao_joelho"
  | "isolador"
  | "core"
  | "carregamento";

export type Equipment =
  | "barra"
  | "halter"
  | "maquina"
  | "cabo"
  | "peso_corporal"
  | "kettlebell"
  | "elastico"
  | "outro";

export type MuscleRole = "primario" | "secundario";
export type SetKind = "aquecimento" | "trabalho";
export type SessionStatus = "em_andamento" | "concluida";
export type RecordKind = "carga_maxima" | "melhor_serie" | "volume_serie" | "volume_sessao";

export type Muscle = { id: string; name: string; region: string; sortOrder: number };

/** Vínculo muscular. Primário conta 1 série no volume; secundário, 0,5. */
export type ExerciseMuscle = { muscleId: string; role: MuscleRole };

/** Exercício do catálogo global, que vem dentro do app. O id é o slug. */
export type CatalogExercise = {
  id: string;
  name: string;
  pattern: Pattern;
  equipment: Equipment;
  isUnilateral: boolean;
  defaultRestSeconds: number;
  loadStepKg: number;
  cue: string | null;
  muscles: ExerciseMuscle[];
};

/** Exercício criado pelo usuário. Arquivado some da lista, nunca do histórico. */
export type CustomExercise = CatalogExercise & {
  archivedAt: string | null;
  createdAt: string;
};

export type Profile = {
  /** Sempre "eu": sem login, há um único usuário por aparelho. */
  id: "eu";
  displayName: string;
  heightCm: number | null;
  startingWeightKg: number | null;
  focus: "hipertrofia" | "forca" | "emagrecimento" | "recomposicao" | "saude" | null;
  level: "iniciante" | "intermediario" | "avancado" | null;
  weeklyTarget: number;
  timezone: string;
  onboardedAt: string | null;
};

export type Routine = {
  id: string;
  name: string;
  description: string | null;
  /** No máximo uma ativa e não arquivada; garantido pela camada de dados. */
  isActive: boolean;
  archivedAt: string | null;
  createdAt: string;
};

export type RoutineDay = {
  id: string;
  routineId: string;
  name: string;
  /** Sequência, não calendário. Desempate por id. */
  position: number;
  /** 0 = domingo. Só uma dica. */
  suggestedWeekday: number | null;
  notes: string | null;
};

export type RoutineExercise = {
  id: string;
  routineDayId: string;
  exerciseId: string;
  position: number;
  targetSets: number;
  repMin: number;
  repMax: number;
  targetRir: number | null;
  restSeconds: number;
  /** Nulo = usa o incremento do exercício. */
  loadStepKgOverride: number | null;
  /** Sempre nulo por enquanto: superset não é exposto. */
  supersetGroup: string | null;
  notes: string | null;
};

export type WorkoutSession = {
  id: string;
  /** Nulos quando o programa ou o dia foram apagados: o snapshot basta. */
  routineId: string | null;
  routineDayId: string | null;
  titleSnapshot: string;
  status: SessionStatus;
  startedAt: string;
  finishedAt: string | null;
  perceivedEffort: number | null;
  notes: string | null;
};

export type SessionExercise = {
  id: string;
  sessionId: string;
  exerciseId: string;
  routineExerciseId: string | null;
  position: number;
  /** Snapshot da prescrição. Os três alvos são nulos juntos. */
  targetSets: number | null;
  repMin: number | null;
  repMax: number | null;
  targetRir: number | null;
  restSeconds: number;
  /** Incremento já resolvido no início da sessão. */
  loadStepKg: number;
  notes: string | null;
  createdAt: string;
};

export type WorkoutSet = {
  /** Gerado no cliente: registrar duas vezes cai no mesmo registro. */
  id: string;
  sessionExerciseId: string;
  setNumber: number;
  kind: SetKind;
  /** Nulo = só o peso do corpo. */
  weightKg: number | null;
  reps: number;
  rir: number | null;
  completedAt: string;
};

/** Derivado das séries; recalculado ao concluir e ao corrigir um treino. */
export type PersonalRecord = {
  /** `${exerciseId}:${kind}`: um recorde atual por exercício e tipo. */
  id: string;
  exerciseId: string;
  kind: RecordKind;
  value: number;
  setId: string | null;
  sessionId: string;
  weightKg: number;
  reps: number;
  achievedAt: string;
};

/** Peso para gravar: duas casas, como o numeric(6,2) do banco. */
export function toKg(n: number): number {
  return Math.round(n * 100) / 100;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Linha de controle interno, fora do backup. Hoje guarda só a marca de
 * que os dados vieram do banco antigo, chamado "almore".
 */
export type Meta = {
  id: string;
  value: string;
  at: string;
};
