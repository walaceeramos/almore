"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Navega quando a ação devolve um destino. Na versão com banco, a Server
 * Action chamava `redirect()`; no aparelho a ação é uma função comum, e
 * quem navega é a tela.
 */
export function useRedirectOnSuccess(destino: string | undefined) {
  const router = useRouter();
  useEffect(() => {
    if (destino) router.push(destino);
  }, [destino, router]);
}
