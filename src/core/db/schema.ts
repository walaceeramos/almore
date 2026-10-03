/**
 * Tipos das tabelas, para o TypeScript. NÃO é a fonte de verdade do banco.
 *
 * A fonte de verdade é o SQL em `supabase/migrations/`, escrito à mão. Este
 * arquivo é um retrato parcial: não declara chaves estrangeiras para
 * `auth.users`, CHECK, índices parciais e funcionais, RLS nem triggers.
 * Não rode `drizzle-kit generate` nem `push` — veja "Migrations" no
 * AGENTS.md.
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
