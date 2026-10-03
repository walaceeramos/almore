import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/core/auth/session";
import { listExercises, listMuscles } from "@/features/exercises/queries";
import { exerciseFiltersSchema } from "@/features/exercises/schemas";
import { EQUIPMENT_LABEL } from "@/features/exercises/labels";
import { EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Filtros } from "./filtros";

export const metadata = { title: "Exercícios · Almore" };

export default async function ExerciciosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const sp = await searchParams;

  // Parâmetro inválido na URL não quebra a página: vira filtro vazio.
  const parsed = exerciseFiltersSchema.safeParse({
    busca: typeof sp.busca === "string" ? sp.busca : undefined,
    musculo: typeof sp.musculo === "string" ? sp.musculo : undefined,
    equipamento: typeof sp.equipamento === "string" ? sp.equipamento : undefined,
    padrao: typeof sp.padrao === "string" ? sp.padrao : undefined,
    origem: typeof sp.origem === "string" ? sp.origem : undefined,
  });
  const filtros = parsed.success ? parsed.data : {};

  const [exercicios, muscles] = await Promise.all([listExercises(filtros), listMuscles()]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-condensed text-3xl font-bold">Exercícios</h1>
          <p className="mt-0.5 text-sm text-muted">
            {exercicios.length} {exercicios.length === 1 ? "exercício" : "exercícios"}
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

      <Filtros muscles={muscles} />

      {exercicios.length === 0 ? (
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
                  {e.ownerId && <Badge tone="brand">meu</Badge>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
