import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Play } from "lucide-react";
import { requireUser } from "@/core/auth/session";
import { getRoutine, type RoutineDayDetail } from "@/features/routines/queries";
import { activateRoutine } from "@/features/routines/actions";
import { getLastTrainedDayId, getOpenSession } from "@/features/sessions/queries";
import { StartSessionForm } from "@/features/sessions/components/start-session-form";
import { nextDayId } from "@/core/domain/next-day";
import { prescriptionLabel, rirLabel, weekdayLabel } from "@/features/routines/labels";
import { restLabel } from "@/features/exercises/labels";
import { kg } from "@/core/utils/format";
import { Card, CardTitle, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getRoutine(id);
  return { title: r ? `${r.name} · Almore` : "Programa · Almore" };
}

function Dia({ dia, aberto }: { dia: RoutineDayDetail; aberto: boolean }) {
  const diaSemana = weekdayLabel(dia.suggestedWeekday);

  return (
    <details open={aberto} className="rounded border border-line bg-surface">
      <summary className="flex min-h-14 cursor-pointer items-center gap-2 px-4 py-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-condensed text-lg font-semibold">{dia.name}</span>
          <span className="mt-0.5 block text-[13px] text-muted">
            {dia.exercises.length} {dia.exercises.length === 1 ? "exercício" : "exercícios"}
            {diaSemana && ` · ${diaSemana}`}
          </span>
        </span>
      </summary>

      <div className="border-t border-line">
        {dia.notes && <p className="px-4 py-3 text-sm text-muted">{dia.notes}</p>}

        {dia.exercises.length === 0 ? (
          <p className="px-4 py-5 text-sm text-faint">Nenhum exercício neste dia ainda.</p>
        ) : (
          <ul className="divide-y divide-line">
            {dia.exercises.map((e) => {
              const rir = rirLabel(e.targetRir);
              return (
                <li key={e.id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-[15.5px] font-medium">{e.exerciseName}</span>
                    <span className="shrink-0 font-condensed text-[15px] tabular-nums text-brand">
                      {prescriptionLabel(e.targetSets, e.repMin, e.repMax)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {restLabel(e.restSeconds)} de descanso
                    {rir && ` · ${rir}`}
                    {` · sobe ${kg(e.loadStepKg)} kg`}
                    {e.loadStepKgOverride !== null && " (ajustado)"}
                  </p>
                  {e.notes && <p className="mt-1 text-[13px] text-faint">{e.notes}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}

export default async function ProgramaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const programa = await getRoutine(id);
  if (!programa) notFound();

  const arquivado = programa.archivedAt !== null;
  const totalExercicios = programa.days.reduce((s, d) => s + d.exercises.length, 0);

  const [aberta, ultimoDia] = await Promise.all([getOpenSession(), getLastTrainedDayId(programa.id)]);
  const proximoDia = nextDayId(
    programa.days.map((d) => d.id),
    ultimoDia,
  );

  return (
    <div className="space-y-5">
      <Link href="/treinos" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-body">
        <ArrowLeft className="size-4" aria-hidden />
        Treinos
      </Link>

      <div>
        <div className="flex items-start gap-2">
          <h1 className="font-condensed text-3xl font-bold leading-tight">{programa.name}</h1>
          {programa.isActive && <Badge tone="brand" className="mt-2">ativo</Badge>}
          {arquivado && <Badge className="mt-2">arquivado</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted">
          {programa.days.length} {programa.days.length === 1 ? "dia" : "dias"} · {totalExercicios}{" "}
          {totalExercicios === 1 ? "exercício" : "exercícios"}
        </p>
        {programa.description && <p className="mt-2 text-sm text-muted">{programa.description}</p>}
      </div>

      {aberta ? (
        <Card className="space-y-3">
          <div>
            <p className="text-xs text-faint">Treino em andamento</p>
            <p className="font-condensed text-lg font-semibold">{aberta.title}</p>
          </div>
          <ButtonLink href={`/executar/${aberta.id}`} full>
            <Play className="size-4" aria-hidden />
            Retomar treino
          </ButtonLink>
        </Card>
      ) : (
        !arquivado &&
        proximoDia && (
          <Card>
            <StartSessionForm
              days={programa.days.map((d) => ({ id: d.id, name: d.name }))}
              defaultDayId={proximoDia}
            />
          </Card>
        )
      )}

      <div className="flex flex-wrap gap-2">
        <ButtonLink href={`/treinos/${programa.id}/editar`} variant="secondary">
          <Pencil className="size-4" aria-hidden />
          Editar
        </ButtonLink>
        {!programa.isActive && !arquivado && (
          <form action={activateRoutine}>
            <input type="hidden" name="id" value={programa.id} />
            <Button type="submit" variant="secondary">
              Tornar ativo
            </Button>
          </form>
        )}
      </div>

      {programa.days.length === 0 ? (
        <EmptyState
          title="Programa sem dias"
          description="Abra o editor para adicionar os dias e os exercícios."
          action={<ButtonLink href={`/treinos/${programa.id}/editar`}>Abrir editor</ButtonLink>}
        />
      ) : (
        <section className="space-y-3">
          <CardTitle>Dias</CardTitle>
          <ul className="space-y-2">
            {programa.days.map((d, i) => (
              <li key={d.id}>
                <Dia dia={d} aberto={i === 0} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Card className="border-dashed bg-transparent">
        <p className="text-[13px] text-faint">
          O veredito antes de cada exercício — subir, manter ou reduzir a carga — usa a faixa de repetições, o RIR
          alvo e o incremento definidos aqui.
        </p>
      </Card>
    </div>
  );
}
