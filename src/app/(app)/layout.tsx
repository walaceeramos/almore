"use client";

import { BottomNav, Sidebar } from "@/components/layout/nav";
import { Topbar } from "@/components/layout/topbar";
import { ProfileGate, useProfile } from "@/components/profile-gate";

function Casca({ children }: { children: React.ReactNode }) {
  const perfil = useProfile();
  return (
    <div className="lg:pl-60">
      <Sidebar />
      <Topbar name={perfil.displayName} />
      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 lg:px-8 lg:pb-12">{children}</main>
      <BottomNav />
    </div>
  );
}

/** Sem perfil concluído, `ProfileGate` manda para /boas-vindas. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProfileGate>
      <Casca>{children}</Casca>
    </ProfileGate>
  );
}
