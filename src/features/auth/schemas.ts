import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Informe seu e-mail")
  .email("E-mail inválido");

export const passwordSchema = z
  .string()
  .min(8, "A senha precisa de pelo menos 8 caracteres")
  .max(72, "A senha é longa demais");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha"),
  proximo: z.string().optional(),
});

export const signUpSchema = z.object({
  displayName: z.string().trim().min(2, "Informe seu nome").max(60),
  email: emailSchema,
  password: passwordSchema,
});

export const resetSchema = z.object({ email: emailSchema });

export const onboardingSchema = z.object({
  displayName: z.string().trim().min(2, "Informe seu nome").max(60),
  heightCm: z.coerce.number().int().min(80).max(260),
  startingWeightKg: z.coerce.number().min(20).max(400),
  focus: z.enum(["hipertrofia", "forca", "emagrecimento", "recomposicao", "saude"]),
  level: z.enum(["iniciante", "intermediario", "avancado"]),
  weeklyTarget: z.coerce.number().int().min(1).max(7),
});

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: string;
};
