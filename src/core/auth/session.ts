import { redirect } from "next/navigation";
import { createClient } from "./server";
import type { Profile } from "@/core/db/schema";

export type SessionUser = {
  id: string;
  email: string;
  profile: Profile | null;
};

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
    profile: (profile as Profile | null) ?? null,
  };
}

/** Para Server Components dentro de (app). O middleware já barrou, isto é a segunda trava. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  return user;
}
