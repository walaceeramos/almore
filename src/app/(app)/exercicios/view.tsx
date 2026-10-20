"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus } from "lucide-react";
import { listExercises, listMuscles } from "@/features/exercises/queries";
import { exerciseFiltersSchema } from "@/features/exercises/schemas";
import { EQUIPMENT_LABEL } from "@/features/exercises/labels";
import { EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { Filtros } from "./filtros";

export function ExerciciosView() {
  const sp = useSearchParams();

  // Parâmetro inválido na URL não quebra a página: vira filtro vazio.
  const parsed = exerciseFiltersSchema.safeParse({
    busca: sp.get("busca") ?? undefined,
    musculo: sp.get("musculo") ?? undefined,
    equipamento: sp.get("equipamento") ?? undefined,
    padrao: sp.get("padrao") ?? undefined,
    origem: sp.get("origem") ?? undefined,
  });
  const filtros = parsed.success ? parsed.data : {};
  const chave = JSON.stringify(filtros);

  // A chave resume os filtros: a consulta refaz quando algum deles muda.
  const exercicios = useLiveQuery(() => listExercises(filtros), [chave]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-condensed text-3xl font-bold">Exercícios</h1>
          <p className="mt-0.5 text-sm text-muted">
            {exercicios === undefined
              ? " "
              : `${exercicios.length} ${exercicios.length === 1 ? "exercício" : "exercícios"}`}
          </p>
        </div>
        <Link
          href="/exercicios/novo"
          className="inline-flex min-h-11 items-center gap-1.5 rounded bg-brand px-3 text-sm font-semibold text-ink"
        >
          <Plus className="size-4" aria-hidden />
          Novo
        </Link>
      </div>

      <Filtros muscles={listMuscles()} />

      {exercicios === undefined ? (
        <Loading />
      ) : exercicios.length === 0 ? (
        <EmptyState
          title="Nada encontrado"
          description="Tente outro termo ou limpe os filtros. Se o exercício não existe no catálogo, você pode cadastrá-lo."
        />
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {exercicios.map((e) => {
            const primario = e.muscles.find((m) => m.role === "primario");
            return (
              <li key={e.id}>
                <Link href={`/exercicios/${e.id}`} className="flex items-center gap-3 py-3.5 pr-1">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15.5px] font-medium">{e.name}</span>
                    <span className="mt-0.5 block text-[13px] text-muted">
                      {primario?.name ?? "Sem grupo"} · {EQUIPMENT_LABEL[e.equipment]}
                    </span>
                  </span>
                  {e.isCustom && <Badge tone="brand">meu</Badge>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
