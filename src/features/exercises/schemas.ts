import { z } from "zod";
import { PATTERNS, EQUIPMENTS } from "./labels";

export const exerciseFiltersSchema = z.object({
  busca: z.string().trim().max(80).optional(),
  musculo: z.string().trim().max(40).optional(),
  equipamento: z.enum(EQUIPMENTS as [string, ...string[]]).optional(),
  padrao: z.enum(PATTERNS as [string, ...string[]]).optional(),
  origem: z.enum(["todos", "catalogo", "meus"]).optional(),
});

export type ExerciseFilters = z.infer<typeof exerciseFiltersSchema>;

export const customExerciseSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome ao exercício").max(80),
  pattern: z.enum(PATTERNS as [string, ...string[]], { message: "Escolha o padrão de movimento" }),
  equipment: z.enum(EQUIPMENTS as [string, ...string[]], { message: "Escolha o equipamento" }),
  primaryMuscle: z.string().min(1, "Escolha o músculo principal"),
  secondaryMuscles: z.array(z.string()).max(4).optional(),
  defaultRestSeconds: z.coerce.number().int().min(15).max(600),
  loadStepKg: z.coerce.number().min(0.25).max(25),
  isUnilateral: z.coerce.boolean().optional(),
  cue: z.string().trim().max(400).optional(),
});

export type CustomExerciseInput = z.infer<typeof customExerciseSchema>;

export type ExerciseActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};
