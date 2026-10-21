import { beforeEach } from "vitest";
import { db } from "@/core/data/db";

/** FormData é o que as ações recebem: elas são Server Actions por forma. */
export function fd(campos: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [chave, valor] of Object.entries(campos)) {
    if (Array.isArray(valor)) valor.forEach((v) => f.append(chave, v));
    else f.set(chave, valor);
  }
  return f;
}

/**
 * Banco zerado antes de cada teste. Apagar e reabrir é mais seguro que
 * limpar tabela por tabela: pega também índice e versão.
 */
export function bancoLimpo() {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });
}

/** Cria um programa com `dias` dias e devolve a rotina com seus dias. */
export async function criaPrograma(nome = "Teste", dias = 2) {
  const { createRoutine } = await import("@/features/routines/actions");
  await createRoutine({}, fd({ name: nome, dayCount: String(dias) }));

  const rotina = (await db.routines.toArray()).find((r) => r.name === nome)!;
  const diasDaRotina = (await db.routineDays.where("routineId").equals(rotina.id).toArray()).sort(
    (a, b) => a.position - b.position,
  );
  return { rotina, dias: diasDaRotina };
}
