import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/core/auth/session";
import { getRecentHistory, getSession, listRecords } from "@/features/sessions/queries";
import { listExercises } from "@/features/exercises/queries";
import { EQUIPMENT_LABEL, restLabel } from "@/features/exercises/labels";
import { prescriptionLabel, rirLabel } from "@/features/routines/labels";
import { suggestProgression } from "@/core/domain/progression";
import { isStagnant } from "@/core/domain/stagnation";
import type { SetRecordKind } from "@/core/domain/records";
import type { PickableExercise } from "@/components/exercise-picker";
import { Execucao, type ExercicioExec, type SerieExec } from "./execucao";

export const metadata = { title: "Treino · Almore" };

export default async function ExecutarPage({ params }: { params: Promise<{ sessaoId: string }> }) {
  const user = await requireUser();
  const { sessaoId } = await params;

  const sessao = await getSession(sessaoId);
  if (!sessao) notFound();
  if (sessao.status === "concluida") redirect(`/executar/${sessao.id}/resumo`);

  // A página é camada de app: fala com as features e converte para a forma
  // que a tela consome. A tela não conhece nenhuma delas por dentro.
  // No fuso do usuário: o servidor roda em UTC e um treino às 22h viraria o dia seguinte.
  const DATA_CURTA = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: user.profile?.timezone ?? "America/Sao_Paulo",
  });

  const idsExercicio = sessao.exercises.map((e) => e.exerciseId);
  const [historico, recordes, catalogo] = await Promise.all([
    getRecentHistory(sessao.id, idsExercicio),
    listRecords(idsExercicio),
    listExercises({}),
  ]);

  const exercicios: ExercicioExec[] = sessao.exercises.map((e) => {
    const passadas = historico[e.exerciseId] ?? [];
    const anterior = passadas[0];
    const { targetSets, repMin, repMax, targetRir } = e;

    // A regra roda aqui, no servidor, sobre o histórico sem a sessão atual.
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
            data: DATA_CURTA.format(anterior.date),
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
        weightKg: s.weightKg === null ? null : Number(s.weightKg),
        reps: s.reps,
        rir: s.rir,
      })),
    ]),
  );

  const seletor: PickableExercise[] = catalogo.map((e) => ({
    id: e.id,
    name: e.name,
    muscleName: e.muscles.find((m) => m.role === "primario")?.name ?? null,
    equipmentLabel: EQUIPMENT_LABEL[e.equipment] ?? e.equipment,
    isOwn: e.ownerId === user.id,
  }));

  return (
    <Execucao
      sessionId={sessao.id}
      title={sessao.title}
      startedAt={sessao.startedAt.getTime()}
      exercicios={exercicios}
      seriesIniciais={series}
      catalogo={seletor}
    />
  );
}
