import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/core/auth/session";
import { getExercise } from "@/features/exercises/queries";
import { archiveCustomExercise } from "@/features/exercises/actions";
import { PATTERN_LABEL, EQUIPMENT_LABEL, restLabel } from "@/features/exercises/labels";
import { kg } from "@/core/utils/format";
import { Card, CardTitle, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await getExercise(id);
  return { title: e ? `${e.name} · Almore` : "Exercício · Almore" };
}

export default async function ExercicioPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const e = await getExercise(id);
  if (!e) notFound();

  const primarios = e.muscles.filter((m) => m.role === "primario");
  const secundarios = e.muscles.filter((m) => m.role === "secundario");
  const meu = e.ownerId === user.id;

  const ficha: [string, string][] = [
    ["Padrão de movimento", PATTERN_LABEL[e.pattern] ?? e.pattern],
    ["Equipamento", EQUIPMENT_LABEL[e.equipment] ?? e.equipment],
    ["Execução", e.isUnilateral ? "Unilateral, um lado por vez" : "Bilateral"],
    ["Descanso sugerido", restLabel(e.defaultRestSeconds)],
    ["Incremento de carga", `${kg(e.loadStepKg)} kg`],
  ];

  return (
    <div className="space-y-5">
      <Link href="/exercicios" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-body">
        <ArrowLeft className="size-4" aria-hidden />
        Exercícios
      </Link>

      <div>
        <div className="flex items-start gap-2">
          <h1 className="font-condensed text-3xl font-bold leading-tight">{e.name}</h1>
          {meu && <Badge tone="brand" className="mt-2">meu</Badge>}
        </div>
        <p className="mt-1 flex flex-wrap gap-1.5">
          {primarios.map((m) => (
            <Badge key={m.id} tone="brand">{m.name}</Badge>
          ))}
          {secundarios.map((m) => (
            <Badge key={m.id}>{m.name}</Badge>
          ))}
        </p>
      </div>

      {e.cue && (
        <Card className="border-l-2 border-l-brand">
          <p className="text-sm text-muted">{e.cue}</p>
        </Card>
      )}

      <Card className="divide-y divide-line p-0">
        {ficha.map(([rotulo, valor]) => (
          <div key={rotulo} className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted">{rotulo}</span>
            <span>{valor}</span>
          </div>
        ))}
      </Card>

      <section className="space-y-3">
        <CardTitle>Seu histórico</CardTitle>
        <EmptyState
          title="Nenhum registro ainda"
          description="Histórico, recordes e evolução de carga aparecem aqui quando a execução de treinos existir."
        />
      </section>

      {meu && (
        <form action={archiveCustomExercise}>
          <input type="hidden" name="id" value={e.id} />
          <button
            type="submit"
            className="min-h-11 rounded border border-bad/40 px-4 text-sm text-bad hover:bg-bad/10"
          >
            Arquivar exercício
          </button>
          <p className="mt-2 text-xs text-faint">
            Arquivar esconde o exercício da lista sem apagar nada. O histórico que apontar para ele continua válido.
          </p>
        </form>
      )}
    </div>
  );
}
