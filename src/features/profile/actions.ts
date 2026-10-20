import { db } from "@/core/data/db";
import { toKg, nowIso } from "@/core/data/types";
import { onboardingSchema, type ProfileActionState } from "./schemas";
import { getProfile } from "./queries";

/** O fuso do aparelho, que é onde o usuário treina. */
function fusoDoAparelho(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
  } catch {
    return "America/Sao_Paulo";
  }
}

export async function completeOnboarding(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const parsed = onboardingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const atual = await getProfile();
  try {
    await db.profile.put({
      id: "eu",
      displayName: parsed.data.displayName,
      heightCm: parsed.data.heightCm,
      startingWeightKg: toKg(parsed.data.startingWeightKg),
      focus: parsed.data.focus,
      level: parsed.data.level,
      weeklyTarget: parsed.data.weeklyTarget,
      timezone: atual?.timezone ?? fusoDoAparelho(),
      onboardedAt: atual?.onboardedAt ?? nowIso(),
    });
  } catch {
    return { error: "Não foi possível salvar no aparelho. Verifique se o navegador permite guardar dados." };
  }

  return { redirectTo: "/inicio" };
}
