import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/core/auth/session";
import { getPreviousPerformance, getSession } from "@/features/sessions/queries";
import { listExercises } from "@/features/exercises/queries";
import { EQUIPMENT_LABEL, restLabel } from "@/features/exercises/labels";
import { prescriptionLabel, rirLabel } from "@/features/routines/labels";
import type { PickableExercise } from "@/components/exercise-picker";
import { Execucao, type ExercicioExec, type SerieExec } from "./execucao";

export const metadata = { title: "Treino · Almore" };

const DATA_CURTA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

export default async function ExecutarPage({ params }: { params: Promise<{ sessaoId: string }> }) {
  const user = await requireUser();
  const { sessaoId } = await params;

  const sessao = await getSession(sessaoId);
  if (!sessao) notFound();
  if (sessao.status === "concluida") redirect(`/executar/${sessao.id}/resumo`);

  // A página é camada de app: fala com as features e converte para a forma
  // que a tela consome. A tela não conhece nenhuma delas por dentro.
  const [anteriores, catalogo] = await Promise.all([
    getPreviousPerformance(
      sessao.id,
      sessao.exercises.map((e) => e.exerciseId),
    ),
    listExercises({}),
  ]);

  const exercicios: ExercicioExec[] = sessao.exercises.map((e) => {
    const anterior = anteriores[e.exerciseId];
    const { targetSets, repMin, repMax } = e;
    return {
      id: e.id,
      exerciseId: e.exerciseId,
      name: e.exerciseName,
      isBodyweight: e.equipment === "peso_corporal",
      equipmentLabel: EQUIPMENT_LABEL[e.equipment] ?? e.equipment,
      targetSets: e.targetSets,
      repMin: e.repMin,
      targetRir: e.targetRir,
      restSeconds: e.restSeconds,
      loadStepKg: e.loadStepKg,
      notes: e.notes,
      prescricao:
        targetSets !== null && repMin !== null && repMax !== null
          ? prescriptionLabel(targetSets, repMin, repMax)
          : null,
      rir: rirLabel(e.targetRir),
      descanso: restLabel(e.restSeconds),
      anterior: anterior
        ? {
            data: DATA_CURTA.format(anterior.date),
            series: anterior.sets.map((s) => ({
              kind: s.kind,
              weightKg: s.weightKg === null ? null : Number(s.weightKg),
              reps: s.reps,
            })),
          }
        : null,
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
