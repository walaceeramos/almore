import { redirect } from "next/navigation";
import { getCurrentUser } from "@/core/auth/session";
import { BottomNav, Sidebar } from "@/components/layout/nav";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");

  // Perfil incompleto não navega: vai para boas-vindas e fica lá até concluir.
  const precisaOnboarding = !user.profile?.onboardedAt;

  if (precisaOnboarding) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-lg px-4 py-8 pt-[calc(2rem+env(safe-area-inset-top,0px))]">
        {children}
      </main>
    );
  }

  return (
    <div className="lg:pl-60">
      <Sidebar />
      <Topbar name={user.profile?.displayName ?? user.email} />
      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 lg:px-8 lg:pb-12">{children}</main>
      <BottomNav />
    </div>
  );
}
