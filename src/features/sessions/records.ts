import { createClient } from "@/core/auth/server";
import { computeRecords, type RecordKind, type RecordSet } from "@/core/domain/records";
import type { SetKind } from "./queries";

const TODOS_OS_TIPOS: RecordKind[] = ["carga_maxima", "melhor_serie", "volume_serie", "volume_sessao"];

type SerieRow = {
  exercise_id: string;
  session_id: string;
  sets: { id: string; kind: SetKind; weight_kg: string | null; reps: number; rir: number | null; completed_at: string }[] | null;
  workout_sessions: { status: string } | null;
};

/**
 * Recalcula do zero os recordes dos exercícios informados, a partir de
 * todas as séries das sessões concluídas.
 *
 * Do zero, e não comparando com o recorde anterior: é o que deixa a edição
 * retroativa da Fase 6 correta sem caso especial. Chamado ao concluir uma
 * sessão, para os exercícios dela.
 *
 * Falha aqui não desfaz a conclusão do treino: recorde é derivado, e o
 * próximo recálculo daquele exercício corrige.
 */
export async function recomputeRecords(userId: string, exerciseIds: string[]): Promise<void> {
  if (exerciseIds.length === 0) return;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("session_exercises")
    .select(
      `exercise_id, session_id,
       sets ( id, kind, weight_kg, reps, rir, completed_at ),
       workout_sessions!inner ( status )`,
    )
    .in("exercise_id", exerciseIds)
    .eq("workout_sessions.status", "concluida");

  if (error || !data) return;

  const porExercicio = new Map<string, RecordSet[]>(exerciseIds.map((id) => [id, []]));
  for (const row of data as unknown as SerieRow[]) {
    const lista = porExercicio.get(row.exercise_id);
    if (!lista) continue;
    for (const s of row.sets ?? []) {
      lista.push({
        id: s.id,
        sessionId: row.session_id,
        achievedAt: s.completed_at,
        kind: s.kind,
        weightKg: s.weight_kg === null ? null : Number(s.weight_kg),
        reps: s.reps,
        rir: s.rir,
      });
    }
  }

  const linhas = [];
  const semRecorde: { exerciseId: string; kinds: RecordKind[] }[] = [];

  for (const [exerciseId, series] of porExercicio) {
    const recordes = computeRecords(series);
    const ausentes = TODOS_OS_TIPOS.filter((k) => !recordes[k]);
    if (ausentes.length > 0) semRecorde.push({ exerciseId, kinds: ausentes });

    for (const r of Object.values(recordes)) {
      linhas.push({
        user_id: userId,
        exercise_id: exerciseId,
        kind: r.kind,
        // Duas casas, como string: numeric recebe exato.
        value: r.value.toFixed(2),
        set_id: r.setId,
        session_id: r.sessionId,
        weight_kg: r.weightKg.toFixed(2),
        reps: r.reps,
        achieved_at: r.achievedAt,
      });
    }
  }

  if (linhas.length > 0) {
    await supabase.from("personal_records").upsert(linhas, { onConflict: "user_id,exercise_id,kind" });
  }

  // Tipo que deixou de existir (a série de origem virou aquecimento, por
  // exemplo) sai da tabela, senão ficaria um recorde sem lastro.
  for (const { exerciseId, kinds } of semRecorde) {
    await supabase.from("personal_records").delete().eq("exercise_id", exerciseId).in("kind", kinds);
  }
}
