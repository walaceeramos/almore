"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { getRecentHistory, getSession, listRecords } from "@/features/sessions/queries";
import { listPickableExercises } from "@/features/exercises/picker";
import { EQUIPMENT_LABEL, restLabel } from "@/features/exercises/labels";
import { prescriptionLabel, rirLabel } from "@/features/routines/labels";
import { suggestProgression } from "@/core/domain/progression";
import { isStagnant } from "@/core/domain/stagnation";
import type { SetRecordKind } from "@/core/domain/records";
import { useProfile } from "@/components/profile-gate";
import { Loading } from "@/components/ui/loading";
import { Execucao, type ExercicioExec, type SerieExec } from "./execucao";

async function carregar(sessaoId: string) {
  const sessao = await getSession(sessaoId);
  if (!sessao) return null;
  const ids = sessao.exercises.map((e) => e.exerciseId);
  const [historico, recordes, catalogo] = await Promise.all([
    getRecentHistory(sessao.id, ids),
    listRecords(ids),
    listPickableExercises(),
  ]);
  return { sessao, historico, recordes, catalogo };
}

export function ExecutarView({ sessaoId }: { sessaoId: string }) {
  const router = useRouter();
  const perfil = useProfile();
  // `null` = não existe (ou foi descartada); `undefined` = ainda lendo.
  const dados = useLiveQuery(() => carregar(sessaoId), [sessaoId]);
  const concluida = dados?.sessao.status === "concluida";

  useEffect(() => {
    if (concluida) router.replace(`/executar/${sessaoId}/resumo`);
  }, [concluida, router, sessaoId]);

  if (dados === undefined || concluida) return <Loading full />;
  if (dados === null) {
    return (
      <main className="mx-auto max-w-sm px-5 py-16 text-center">
        <p className="font-condensed text-2xl font-semibold">Treino não encontrado</p>
        <p className="mt-1 text-sm text-muted">Ele foi descartado ou não existe neste aparelho.</p>
        <Link href="/inicio" className="mt-6 inline-block text-brand hover:underline">
          Voltar ao início
        </Link>
      </main>
    );
  }

  const { sessao, historico, recordes, catalogo } = dados;
  // No fuso do usuário: um treino às 22h não pode virar o dia seguinte.
  const dataCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: perfil.timezone });

  const exercicios: ExercicioExec[] = sessao.exercises.map((e) => {
    const passadas = historico[e.exerciseId] ?? [];
    const anterior = passadas[0];
    const { targetSets, repMin, repMax, targetRir } = e;

    // A regra roda sobre o histórico sem a sessão atual.
    const veredito = suggestProgression({ targetSets, repMin, repMax, targetRir }, e.loadStepKg, passadas);

    const melhores: Partial<Record<SetRecordKind, number>> = {};
    for (const r of recordes) {
      if (r.exerciseId === e.exerciseId && r.kind !== "volume_sessao") melhores[r.kind] = r.value;
    }

    return {
      id: e.id,
      exerciseId: e.exerciseId,
      name: e.exerciseName,
      isBodyweight: e.equipment === "peso_corporal",
      equipmentLabel: EQUIPMENT_LABEL[e.equipment] ?? e.equipment,
      targetSets,
      repMin,
      targetRir,
      restSeconds: e.restSeconds,
      loadStepKg: e.loadStepKg,
      notes: e.notes,
      prescricao:
        targetSets !== null && repMin !== null && repMax !== null
          ? prescriptionLabel(targetSets, repMin, repMax)
          : null,
      rir: rirLabel(targetRir),
      descanso: restLabel(e.restSeconds),
      anterior: anterior
        ? {
            data: dataCurta.format(anterior.date),
            series: anterior.sets.map((s) => ({ kind: s.kind, weightKg: s.weightKg, reps: s.reps })),
          }
        : null,
      veredito,
      estagnado: isStagnant(passadas.map((p) => p.sets)),
      recordes: melhores,
    };
  });

  const series: Record<string, SerieExec[]> = Object.fromEntries(
    sessao.exercises.map((e) => [
      e.id,
      e.sets.map((s) => ({
        id: s.id,
        setNumber: s.setNumber,
        kind: s.kind,
        weightKg: s.weightKg,
        reps: s.reps,
        rir: s.rir,
      })),
    ]),
  );

  return (
    <Execucao
      sessionId={sessao.id}
      title={sessao.title}
      startedAt={sessao.startedAt.getTime()}
      exercicios={exercicios}
      seriesIniciais={series}
      catalogo={catalogo}
    />
  );
}
