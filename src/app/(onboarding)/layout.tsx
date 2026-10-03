import { redirect } from "next/navigation";
import { getCurrentUser } from "@/core/auth/session";

/**
 * Grupo próprio, fora de (app), de propósito: o layout de (app) manda para
 * cá quem ainda não concluiu o onboarding. Se esta tela morasse lá dentro,
 * o redirecionamento entraria em laço.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");

  // Já concluiu: não refaz o onboarding.
  if (user.profile?.onboardedAt) redirect("/inicio");

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-4 py-8 pt-[calc(2rem+env(safe-area-inset-top,0px))]">
      {children}
    </main>
  );
}
