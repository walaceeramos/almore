import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Trophy } from "lucide-react";
import { requireUser } from "@/core/auth/session";
import { getSession, listSessionRecords } from "@/features/sessions/queries";
import { RECORD_LABEL, recordValue } from "@/features/sessions/labels";
import { listExercises } from "@/features/exercises/queries";
import { EQUIPMENT_LABEL } from "@/features/exercises/labels";
import { prescriptionLabel } from "@/features/routines/labels";
import { tonnageKg } from "@/core/domain/volume";
import { durationLabel, localDate, localTime } from "@/core/utils/date";
import { Card, CardTitle } from "@/components/ui/card";
import type { PickableExercise } from "@/components/exercise-picker";
import { EditorHistorico, type ExercicioHist } from "./editor";

export async function generateMetadata({ params }: { params: Promise<{ sessaoId: string }> }) {
  const { sessaoId } = await params;
  const s = await getSession(sessaoId);
  return { title: s ? `${s.title} · Almore` : "Treino · Almore" };
}

const NUMERO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export default async function TreinoHistoricoPage({ params }: { params: Promise<{ sessaoId: string }> }) {
  const user = await requireUser();
  const fuso = user.profile?.timezone ?? "America/Sao_Paulo";
  const { sessaoId } = await params;

  const [sessao, recordes, catalogo] = await Promise.all([
    getSession(sessaoId),
    listSessionRecords(sessaoId),
    listExercises({}),
  ]);
  // Sessão de outra conta cai aqui também: o RLS devolve nada.
  if (!sessao) notFound();
  // Em andamento se corrige na própria execução.
  if (sessao.status !== "concluida" || !sessao.finishedAt) redirect(`/executar/${sessao.id}`);

  const todas = sessao.exercises.flatMap((e) => e.sets);
  const dataLonga = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: fuso,
  }).format(sessao.startedAt);

  const exercicios: ExercicioHist[] = sessao.exercises.map((e) => {
    const { targetSets, repMin, repMax } = e;
    return {
      id: e.id,
      exerciseId: e.exerciseId,
      name: e.exerciseName,
      isBodyweight: e.equipment === "peso_corporal",
      loadStepKg: e.loadStepKg,
      prescricao:
        targetSets !== null && repMin !== null && repMax !== null
          ? prescriptionLabel(targetSets, repMin, repMax)
          : null,
      series: e.sets.map((s) => ({
        id: s.id,
        setNumber: s.setNumber,
        kind: s.kind,
        weightKg: s.weightKg === null ? null : Number(s.weightKg),
        reps: s.reps,
        rir: s.rir,
      })),
    };
  });

  const seletor: PickableExercise[] = catalogo.map((e) => ({
    id: e.id,
    name: e.name,
    muscleName: e.muscles.find((m) => m.role === "primario")?.name ?? null,
    equipmentLabel: EQUIPMENT_LABEL[e.equipment] ?? e.equipment,
    isOwn: e.ownerId === user.id,
  }));

  return (
    <div className="space-y-5">
      <Link href="/historico" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-body">
        <ArrowLeft className="size-4" aria-hidden />
        Histórico
      </Link>

      <div>
        <p className="text-sm capitalize text-muted">{dataLonga}</p>
        <h1 className="font-condensed text-3xl font-bold leading-tight">{sessao.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {localTime(sessao.startedAt, fuso)} às {localTime(sessao.finishedAt, fuso)} ·{" "}
          {durationLabel((sessao.finishedAt.getTime() - sessao.startedAt.getTime()) / 1000)} ·{" "}
          {todas.filter((s) => s.kind === "trabalho").length} séries de trabalho · {NUMERO.format(tonnageKg(todas))} kg
        </p>
      </div>

      {recordes.length > 0 && (
        <section className="space-y-2">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-4 text-brand" aria-hidden />
            Recordes que este treino detém
          </CardTitle>
          <Card className="divide-y divide-line border-brand/40 bg-brand/5 p-0">
            {recordes.map((r) => (
              <div key={`${r.exerciseId}-${r.kind}`} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium">{r.exerciseName}</span>
                  <span className="text-[13px] text-muted">{RECORD_LABEL[r.kind]}</span>
                </span>
                <span className="shrink-0 font-condensed text-lg tabular-nums text-brand">{recordValue(r)}</span>
              </div>
            ))}
          </Card>
        </section>
      )}

      <EditorHistorico
        sessionId={sessao.id}
        finishedAt={sessao.finishedAt.toISOString()}
        meta={{
          date: localDate(sessao.startedAt, fuso),
          start: localTime(sessao.startedAt, fuso),
          end: localTime(sessao.finishedAt, fuso),
          perceivedEffort: sessao.perceivedEffort,
          notes: sessao.notes ?? "",
        }}
        exercicios={exercicios}
        catalogo={seletor}
      />
    </div>
  );
}
