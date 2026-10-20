import { z } from "zod";

/** Espelha os CHECK da migration 0006. O banco é a última palavra. */
const uuidSchema = z.string().uuid("Identificador inválido");

/** Vazio vira nulo; usado nos campos opcionais que chegam por FormData. */
function opcional<T extends z.ZodTypeAny>(schema: T) {
  return z
    .union([schema, z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : (v as z.infer<T>)));
}

export const startSessionSchema = z.object({ routineDayId: uuidSchema });

export const sessionIdSchema = z.object({ id: uuidSchema });

export const saveSetSchema = z.object({
  /** Gerado no cliente. O mesmo id em duas chamadas é a mesma série. */
  id: uuidSchema,
  sessionExerciseId: uuidSchema,
  setNumber: z.coerce.number().int().min(1).max(50),
  kind: z.enum(["aquecimento", "trabalho"]),
  /** Vazio = só o peso do corpo. */
  weightKg: opcional(z.coerce.number().min(0, "Carga não pode ser negativa").max(999.99)),
  reps: z.coerce.number().int().min(0).max(100),
  rir: opcional(z.coerce.number().int().min(0).max(10)),
  /**
   * Só o histórico manda: série acrescentada num treino antigo precisa da
   * data dele, não de agora. Na execução fica de fora e o banco usa now().
   */
  completedAt: z.string().datetime({ offset: true }).optional(),
});

export const updateSessionSchema = z
  .object({
    id: uuidSchema,
    /** No fuso do usuário, como o campo de data devolve. */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
    start: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido"),
    end: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido"),
    perceivedEffort: opcional(z.coerce.number().int().min(1).max(10)),
    notes: z.string().trim().max(500, "No máximo 500 caracteres").optional(),
  });

export const setIdSchema = z.object({ id: uuidSchema });

export const addSessionExerciseSchema = z.object({
  sessionId: uuidSchema,
  exerciseId: uuidSchema,
});

export const finishSessionSchema = z.object({
  id: uuidSchema,
  perceivedEffort: opcional(z.coerce.number().int().min(1).max(10)),
  notes: z.string().trim().max(500, "No máximo 500 caracteres").optional(),
});

export type SessionActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** Formulário que fica na tela depois de salvar precisa dizer que salvou. */
  ok?: boolean;
  /** A tela navega para cá quando a ação conclui. */
  redirectTo?: string;
};
