/**
 * Tipos das tabelas, para o TypeScript. NÃO é a fonte de verdade do banco.
 *
 * A fonte de verdade é o SQL em `supabase/migrations/`, escrito à mão. Este
 * arquivo é um retrato parcial: não declara chaves estrangeiras para
 * `auth.users`, CHECK, índices parciais e funcionais, RLS nem triggers.
 * O Drizzle aqui serve apenas para tipos: nunca gera nem aplica o SQL. O
 * projeto não tem `drizzle.config.ts` nem scripts de migration — veja
 * "Migrations" no AGENTS.md.
 *
 * Hoje cobre `profiles` (Fase 1) e o catálogo de exercícios (Fase 2). As
 * demais tabelas do planejamento entram nas fases seguintes.
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  date,
  boolean,
  primaryKey,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";

export const unitSystem = pgEnum("unit_system", ["metric", "imperial"]);
export const goalFocus = pgEnum("goal_focus", [
  "hipertrofia",
  "forca",
  "emagrecimento",
  "recomposicao",
  "saude",
]);
export const experienceLevel = pgEnum("experience_level", [
  "iniciante",
  "intermediario",
  "avancado",
]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  displayName: text("display_name").notNull(),
  birthDate: date("birth_date"),
  heightCm: integer("height_cm"),
  startingWeightKg: numeric("starting_weight_kg", { precision: 6, scale: 2 }),
  focus: goalFocus("focus"),
  level: experienceLevel("level"),
  weeklyTarget: integer("weekly_target").notNull().default(3),
  units: unitSystem("units").notNull().default("metric"),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

/* ------------------------------------------------------------------ *
 * Fase 2 — catálogo de exercícios
 * ------------------------------------------------------------------ */

export const movementPattern = pgEnum("movement_pattern", [
  "empurrar_horizontal",
  "empurrar_vertical",
  "puxar_horizontal",
  "puxar_vertical",
  "agachamento",
  "dobradica_quadril",
  "extensao_joelho",
  "flexao_joelho",
  "isolador",
  "core",
  "carregamento",
]);

export const equipmentKind = pgEnum("equipment_kind", [
  "barra",
  "halter",
  "maquina",
  "cabo",
  "peso_corporal",
  "kettlebell",
  "elastico",
  "outro",
]);

export const muscleRole = pgEnum("muscle_role", ["primario", "secundario"]);

/** Tabela de referência. Somente leitura para o usuário. */
export const muscles = pgTable("muscles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  region: text("region").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Nulo = exercício global do catálogo. Preenchido = personalizado do usuário. */
    ownerId: uuid("owner_id"),
    slug: text("slug"),
    name: text("name").notNull(),
    pattern: movementPattern("pattern").notNull(),
    equipment: equipmentKind("equipment").notNull(),
    isUnilateral: boolean("is_unilateral").notNull().default(false),
    defaultRestSeconds: integer("default_rest_seconds").notNull().default(120),
    /** Incremento mínimo de carga, em kg. Halter 2, máquina 2,5 a 5. */
    loadStepKg: numeric("load_step_kg", { precision: 5, scale: 2 }).notNull().default("2.5"),
    cue: text("cue"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("exercises_owner_idx").on(t.ownerId),
    index("exercises_pattern_idx").on(t.pattern),
    index("exercises_equipment_idx").on(t.equipment),
  ],
);

/**
 * Distribuição de volume. `contribution` é convenção, não fisiologia:
 * primário conta 1 série, secundário conta 0,5.
 */
export const exerciseMuscles = pgTable(
  "exercise_muscles",
  {
    exerciseId: uuid("exercise_id").notNull(),
    muscleId: text("muscle_id").notNull(),
    role: muscleRole("role").notNull(),
    contribution: numeric("contribution", { precision: 3, scale: 2 }).notNull().default("1.00"),
  },
  (t) => [
    primaryKey({ columns: [t.exerciseId, t.muscleId] }),
    index("exercise_muscles_muscle_idx").on(t.muscleId),
  ],
);

export type Muscle = typeof muscles.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type ExerciseMuscle = typeof exerciseMuscles.$inferSelect;

/* ------------------------------------------------------------------ *
 * Fase 3 — programas de treino
 *
 * Prescrição, não execução. Como em toda esta folha, os CHECK, o índice
 * único parcial de rotina ativa, as políticas de RLS e os triggers moram
 * só na migration 0005.
 * ------------------------------------------------------------------ */

export const routines = pgTable(
  "routines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    /** No máximo uma ativa por usuário, garantido por índice parcial no SQL. */
    isActive: boolean("is_active").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("routines_user_idx").on(t.userId)],
);

export const routineDays = pgTable(
  "routine_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routineId: uuid("routine_id").notNull(),
    name: text("name").notNull(),
    /** Sequência, não calendário. Não é único: ver comentário na 0005. */
    position: integer("position").notNull(),
    /** Dica opcional, 0 = domingo. Não amarra o dia ao calendário. */
    suggestedWeekday: integer("suggested_weekday"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("routine_days_order_idx").on(t.routineId, t.position)],
);

export const routineExercises = pgTable(
  "routine_exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routineDayId: uuid("routine_day_id").notNull(),
    /** FK com ON DELETE RESTRICT no SQL: exercício prescrito não se apaga. */
    exerciseId: uuid("exercise_id").notNull(),
    position: integer("position").notNull(),
    targetSets: integer("target_sets").notNull().default(3),
    /** Faixa de repetições: entrada da progressão dupla na Fase 5. */
    repMin: integer("rep_min").notNull(),
    repMax: integer("rep_max").notNull(),
    targetRir: integer("target_rir"),
    restSeconds: integer("rest_seconds").notNull().default(120),
    /** Nulo = usa exercises.load_step_kg. Ver resolveLoadStep em core/domain. */
    loadStepKgOverride: numeric("load_step_kg_override", { precision: 5, scale: 2 }),
    /** Mesmo valor no mesmo dia forma um superset. Nulo em toda a Fase 3. */
    supersetGroup: text("superset_group"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("routine_exercises_order_idx").on(t.routineDayId, t.position),
    index("routine_exercises_exercise_idx").on(t.exerciseId),
  ],
);

export type Routine = typeof routines.$inferSelect;
export type RoutineDay = typeof routineDays.$inferSelect;
export type RoutineExercise = typeof routineExercises.$inferSelect;
