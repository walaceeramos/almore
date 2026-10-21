import { z } from "zod";
import { exerciseIdSchema, rowIdSchema as uuidSchema } from "@/core/data/id-schemas";

/** Espelha os CHECK da migration 0005. O banco é a última palavra. */
const nameSchema = z.string().trim().min(2, "Dê um nome ao programa").max(60);
const dayNameSchema = z.string().trim().min(1, "Dê um nome ao dia").max(60);
const notesSchema = z.string().trim().max(300).optional();

export const createRoutineSchema = z.object({
  name: nameSchema,
  description: z.string().trim().max(300).optional(),
  /** Quantos dias criar já numerados, para o usuário cair no editor pronto. */
  dayCount: z.coerce.number().int().min(1, "Pelo menos um dia").max(7, "No máximo sete dias"),
});

export const renameRoutineSchema = z.object({
  id: uuidSchema,
  name: nameSchema,
  description: z.string().trim().max(300).optional(),
});

export const routineIdSchema = z.object({ id: uuidSchema });

export const daySchema = z.object({
  id: uuidSchema,
  name: dayNameSchema,
  /** 0 = domingo. Vazio significa sem sugestão, e não é erro. */
  suggestedWeekday: z
    .union([z.coerce.number().int().min(0).max(6), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  notes: notesSchema,
});

export const addDaySchema = z.object({ routineId: uuidSchema });

export const addExerciseSchema = z.object({
  routineDayId: uuidSchema,
  // Slug no catálogo, UUID no personalizado. Ver core/data/id-schemas.
  exerciseId: exerciseIdSchema,
});

export const prescriptionSchema = z
  .object({
    id: uuidSchema,
    targetSets: z.coerce.number().int().min(1).max(10),
    repMin: z.coerce.number().int().min(1).max(100),
    repMax: z.coerce.number().int().min(1).max(100),
    targetRir: z
      .union([z.coerce.number().int().min(0).max(5), z.literal("")])
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    restSeconds: z.coerce.number().int().min(15).max(600),
    /** Vazio significa herdar o incremento do exercício. */
    loadStepKgOverride: z
      .union([z.coerce.number().positive().max(25), z.literal("")])
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    notes: notesSchema,
  })
  .refine((d) => d.repMin <= d.repMax, {
    message: "O mínimo não pode ser maior que o máximo",
    path: ["repMax"],
  });

/** Reordenação manda a lista inteira: é ela que vira um upsert só. */
export const reorderSchema = z.object({
  ids: z.array(uuidSchema).min(1),
});

export type RoutineActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** A tela navega para cá quando a ação conclui. */
  redirectTo?: string;
};
