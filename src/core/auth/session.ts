import { redirect } from "next/navigation";
import { createClient } from "./server";
import type { Profile } from "@/core/db/schema";

export type SessionUser = {
  id: string;
  email: string;
  profile: Profile | null;
};

/**
 * Linha crua de `profiles`. O Postgres devolve os nomes de coluna em
 * snake_case; o tipo do Drizzle é camelCase. Sem a conversão abaixo todo
 * campo lido viria `undefined`, e um cast simples esconderia isso do
 * compilador. Mesmo padrão de `features/exercises/queries.ts`.
 */
type ProfileRow = {
  id: string;
  display_name: string;
  birth_date: string | null;
  height_cm: number | null;
  starting_weight_kg: string | null;
  focus: Profile["focus"];
  level: Profile["level"];
  weekly_target: number;
  units: Profile["units"];
  timezone: string;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
};

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    birthDate: row.birth_date,
    heightCm: row.height_cm,
    startingWeightKg: row.starting_weight_kg,
    focus: row.focus,
    level: row.level,
    weeklyTarget: row.weekly_target,
    units: row.units,
    timezone: row.timezone,
    onboardedAt: row.onboarded_at ? new Date(row.onboarded_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Usuário autenticado ou null. Sempre `getUser`, nunca `getSession`:
 * `getSession` confia no cookie sem validar o token no servidor.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .maybeSingle();

  return {
    id: data.user.id,
    email: data.user.email ?? "",
    profile: profile ? toProfile(profile as ProfileRow) : null,
  };
}

/** Para Server Components dentro de (app). O middleware já barrou, isto é a segunda trava. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  return user;
}
