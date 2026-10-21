"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Trophy } from "lucide-react";
import { getSession, listSessionRecords } from "@/features/sessions/queries";
import { RECORD_LABEL, recordValue } from "@/features/sessions/labels";
import { listPickableExercises } from "@/features/exercises/picker";
import { prescriptionLabel } from "@/features/routines/labels";
import { tonnageKg } from "@/core/domain/volume";
import { durationLabel, localDate, localTime } from "@/core/utils/date";
import { useProfile } from "@/components/profile-gate";
import { Card, CardTitle, EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";
import { EditorHistorico, type ExercicioHist } from "./editor";

const NUMERO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function TreinoHistoricoView({ sessaoId }: { sessaoId: string }) {
  const router = useRouter();
  const fuso = useProfile().timezone;
  const dados = useLiveQuery(async () => {
    const [sessao, recordes, seletor] = await Promise.all([
      getSession(sessaoId),
      listSessionRecords(sessaoId),
      listPickableExercises(),
    ]);
    return { sessao, recordes, seletor };
  }, [sessaoId]);

  // Em andamento se corrige na própria execução.
  const emAndamento = dados?.sessao?.status === "em_andamento";
  useEffect(() => {
    if (emAndamento) router.replace(`/executar/${sessaoId}`);
  }, [emAndamento, router, sessaoId]);

  if (dados === undefined || emAndamento) return <Loading />;
  const { sessao, recordes, seletor } = dados;
  if (!sessao || !sessao.finishedAt) {
    return (
      <EmptyState
        title="Treino não encontrado"
        description="Ele foi excluído ou não existe neste aparelho."
        action={<ButtonLink href="/historico">Ver histórico</ButtonLink>}
      />
    );
  }

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
        weightKg: s.weightKg,
        reps: s.reps,
        rir: s.rir,
      })),
    };
  });

  return (
    <div className="space-y-5">
      <title>{`${sessao.title} · SériePro`}</title>
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
