"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/core/auth/server";
import { requireUser } from "@/core/auth/session";
import { siteUrl } from "@/config/env";
import { safeInternalPath } from "@/core/utils/safe-path";
import {
  signInSchema,
  signUpSchema,
  resetSchema,
  newPasswordSchema,
  onboardingSchema,
  type ActionState,
} from "./schemas";

/** Mensagens do Supabase vêm em inglês; traduzimos as comuns. */
function traduzir(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar. Verifique a caixa de entrada.";
  if (m.includes("user already registered")) return "Já existe uma conta com esse e-mail.";
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas. Aguarde alguns minutos.";
  if (m.includes("password")) return "Senha inválida ou fraca demais.";
  return "Não foi possível concluir. Tente de novo em instantes.";
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: traduzir(error.message) };

  redirect(safeInternalPath(parsed.data.proximo));
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });
  if (error) return { error: traduzir(error.message) };

  return { success: "Conta criada. Confirme o e-mail que enviamos para ativar o acesso." };
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/nova-senha`,
  });

  // Resposta idêntica exista ou não a conta, para não vazar quem tem cadastro.
  return { success: "Se existir uma conta com esse e-mail, o link de redefinição chegou na caixa de entrada." };
}

/**
 * Fim do fluxo de "esqueci minha senha". O link do e-mail passa pelo
 * callback, que troca o código por sessão; por isso aqui já há usuário.
 */
export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: traduzir(error.message) };

  redirect("/inicio");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}

export async function completeOnboarding(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = onboardingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      height_cm: parsed.data.heightCm,
      starting_weight_kg: parsed.data.startingWeightKg,
      focus: parsed.data.focus,
      level: parsed.data.level,
      weekly_target: parsed.data.weeklyTarget,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { error: "Não foi possível salvar seu perfil. Tente de novo." };

  revalidatePath("/", "layout");
  redirect("/inicio");
}
