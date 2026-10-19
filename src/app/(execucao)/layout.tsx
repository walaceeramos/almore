import { redirect } from "next/navigation";
import { getCurrentUser } from "@/core/auth/session";

/**
 * Grupo próprio, fora de (app), de propósito: o modo execução é a única
 * tela sem navegação. Disputar toque com a barra inferior durante uma série
 * é erro de usabilidade caro. As mesmas travas de (app) valem aqui.
 */
export default async function ExecucaoLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  if (!user.profile?.onboardedAt) redirect("/boas-vindas");

  return <div className="min-h-dvh">{children}</div>;
}
