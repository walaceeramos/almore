import { db } from "@/core/data/db";
import type { PersonalRecord, RecordKind } from "@/core/data/types";
import { computeRecords, type RecordSet } from "@/core/domain/records";

/**
 * Recalcula do zero os recordes dos exercícios informados, a partir de
 * todas as séries das sessões concluídas.
 *
 * Do zero, e não comparando com o recorde anterior: é o que deixa a
 * correção de um treino antigo correta sem caso especial. Chamado ao
 * concluir uma sessão e a cada correção em treino concluído.
 *
 * Roda dentro da transação de quem chama, quando houver: Dexie reaproveita
 * a transação aberta se as tabelas couberem nela.
 */
export async function recomputeRecords(exerciseIds: string[]): Promise<void> {
  if (exerciseIds.length === 0) return;

  await db.transaction("rw", [db.sessions, db.sessionExercises, db.sets, db.personalRecords], async () => {
    const linhas = await db.sessionExercises.where("exerciseId").anyOf(exerciseIds).toArray();
    const sessoes = await db.sessions.bulkGet([...new Set(linhas.map((l) => l.sessionId))]);
    const concluidas = new Set(sessoes.filter((s) => s?.status === "concluida").map((s) => s!.id));
    const validas = linhas.filter((l) => concluidas.has(l.sessionId));
    const series = validas.length
      ? await db.sets.where("sessionExerciseId").anyOf(validas.map((l) => l.id)).toArray()
      : [];

    const porLinha = new Map(validas.map((l) => [l.id, l]));
    const porExercicio = new Map<string, RecordSet[]>(exerciseIds.map((id) => [id, []]));
    for (const s of series) {
      const l = porLinha.get(s.sessionExerciseId);
      if (!l) continue;
      porExercicio.get(l.exerciseId)?.push({
        id: s.id,
        sessionId: l.sessionId,
        achievedAt: s.completedAt,
        kind: s.kind,
        weightKg: s.weightKg,
        reps: s.reps,
        rir: s.rir,
      });
    }

    const novos: PersonalRecord[] = [];
    for (const [exerciseId, lista] of porExercicio) {
      for (const r of Object.values(computeRecords(lista))) {
        novos.push({
          id: `${exerciseId}:${r.kind as RecordKind}`,
          exerciseId,
          kind: r.kind,
          value: r.value,
          setId: r.setId,
          sessionId: r.sessionId,
          weightKg: r.weightKg,
          reps: r.reps,
          achievedAt: r.achievedAt,
        });
      }
    }

    // Troca o conjunto inteiro: tipo que deixou de existir (a série de
    // origem virou aquecimento, por exemplo) sai junto.
    await db.personalRecords.where("exerciseId").anyOf(exerciseIds).delete();
    await db.personalRecords.bulkPut(novos);
  });
}
