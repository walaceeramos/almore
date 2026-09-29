/**
 * Fonte única de verdade do banco.
 *
 * Fase 1 define apenas `profiles`. As demais tabelas do planejamento
 * (routines, workout_sessions, sets, ...) entram nas fases seguintes.
 *
 * `profiles.id` é 1:1 com `auth.users.id`. A tabela auth.users não é
 * declarada aqui porque pertence ao schema gerenciado pelo Supabase;
 * a chave estrangeira é criada na migration SQL.
 */
import { pgTable, uuid, text, integer, numeric, timestamp, date, pgEnum } from "drizzle-orm/pg-core";

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
