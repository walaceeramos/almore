"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/core/data/db";
import { Loading } from "@/components/ui/loading";

/**
 * Grupo próprio, fora de (app), de propósito: o layout de (app) manda para
 * cá quem ainda não concluiu o perfil. Se esta tela morasse lá dentro, o
 * redirecionamento entraria em laço.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const perfil = useLiveQuery(async () => (await db.profile.get("eu")) ?? null, []);
  const concluido = Boolean(perfil?.onboardedAt);

  // Já concluiu: não refaz.
  useEffect(() => {
    if (concluido) router.replace("/inicio");
  }, [concluido, router]);

  if (perfil === undefined || concluido) return <Loading full />;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-4 py-8 pt-[calc(2rem+env(safe-area-inset-top,0px))]">
      {children}
    </main>
  );
}
