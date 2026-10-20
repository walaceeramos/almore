import { z } from "zod";

export const onboardingSchema = z.object({
  displayName: z.string().trim().min(2, "Informe seu nome").max(60),
  heightCm: z.coerce.number().int().min(80).max(260),
  startingWeightKg: z.coerce.number().min(20).max(400),
  focus: z.enum(["hipertrofia", "forca", "emagrecimento", "recomposicao", "saude"]),
  level: z.enum(["iniciante", "intermediario", "avancado"]),
  weeklyTarget: z.coerce.number().int().min(1).max(7),
});

export type ProfileActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** A tela navega para cá quando a ação conclui. */
  redirectTo?: string;
};
