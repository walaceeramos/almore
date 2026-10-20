"use client";

import { ProfileGate } from "@/components/profile-gate";

/**
 * Grupo próprio, fora de (app), de propósito: o modo execução é a única
 * tela sem navegação. Disputar toque com a barra inferior durante uma série
 * é erro de usabilidade caro. A mesma trava de perfil de (app) vale aqui.
 */
export default function ExecucaoLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProfileGate>
      <div className="min-h-dvh">{children}</div>
    </ProfileGate>
  );
}
