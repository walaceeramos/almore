"use client";

import { createContext, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, requestPersistence } from "@/core/data/db";
import type { Profile } from "@/core/data/types";
import { Loading } from "@/components/ui/loading";

const ProfileContext = createContext<Profile | null>(null);

/** O perfil do aparelho. Só existe dentro de `ProfileGate`. */
export function useProfile(): Profile {
  const p = useContext(ProfileContext);
  if (!p) throw new Error("useProfile fora de ProfileGate");
  return p;
}

/**
 * Faz o papel que o login fazia: sem perfil concluído, ninguém passa das
 * boas-vindas. Com perfil, entrega-o às páginas, que leem o fuso e a meta
 * semanal dele.
 *
 * Também pede ao navegador para não apagar os dados sozinho — sem banco,
 * eles são a única cópia.
 */
export function ProfileGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // `null` = já leu e não há perfil; `undefined` = ainda lendo.
  const perfil = useLiveQuery(async () => (await db.profile.get("eu")) ?? null, []);
  const liberado = perfil?.onboardedAt ? perfil : null;

  useEffect(() => {
    void requestPersistence();
  }, []);

  useEffect(() => {
    if (perfil === null || (perfil && !perfil.onboardedAt)) router.replace("/boas-vindas");
  }, [perfil, router]);

  if (!liberado) return <Loading full />;
  return <ProfileContext.Provider value={liberado}>{children}</ProfileContext.Provider>;
}
