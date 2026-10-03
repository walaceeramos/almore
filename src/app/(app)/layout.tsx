import { redirect } from "next/navigation";
import { getCurrentUser } from "@/core/auth/session";
import { BottomNav, Sidebar } from "@/components/layout/nav";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");

  // Perfil incompleto não navega: sai do app e só volta depois de concluir.
  // /boas-vindas vive no grupo (onboarding), fora daqui, para não dar laço.
  if (!user.profile?.onboardedAt) redirect("/boas-vindas");

  return (
    <div className="lg:pl-60">
      <Sidebar />
      <Topbar name={user.profile?.displayName ?? user.email} />
      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 lg:px-8 lg:pb-12">{children}</main>
      <BottomNav />
    </div>
  );
}
