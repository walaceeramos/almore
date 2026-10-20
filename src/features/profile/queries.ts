import { db } from "@/core/data/db";
import type { Profile } from "@/core/data/types";

/**
 * Perfil do único usuário do aparelho. Sem login, ele substitui a conta:
 * é a existência de `onboardedAt` que libera o app.
 */
export async function getProfile(): Promise<Profile | null> {
  return (await db.profile.get("eu")) ?? null;
}
