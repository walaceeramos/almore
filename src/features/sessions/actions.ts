import { db } from "@/core/data/db";
import { findExercise } from "@/core/data/exercises";
import { toKg, nowIso, type SessionExercise } from "@/core/data/types";
import { resolveLoadStep } from "@/core/domain/load-step";
import { zonedToUtc } from "@/core/utils/date";
import { newId } from "@/core/utils/uuid";
import { recomputeRecords } from "./records";
import {
  startSessionSchema,
  sessionIdSchema,
  saveSetSchema,
  setIdSchema,
  addSessionExerciseSchema,
  finishSessionSchema,
  updateSessionSchema,
  type SessionActionState,
} from "./schemas";

/*
 * Execução no aparelho. As travas da 0006 viram regra deste arquivo:
 * uma sessão em andamento por vez, cascade de exercícios e séries ao
 * apagar, snapshot da prescrição no início. Toda escrita com mais de uma
 * tabela roda em `db.transaction`, atômica.
 */

const ERRO_GRAVAR = "Não foi possível salvar no aparelho. Tente de novo.";

async function openSessionId(): Promise<string | null> {
  return (await db.sessions.where("status").equals("em_andamento").first())?.id ?? null;
}

async function isFinished(sessionId: string): Promise<boolean> {
  return (await db.sessions.get(sessionId))?.status === "concluida";
}

async function exerciseIdsOf(sessionId: string): Promise<string[]> {
  const linhas = await db.sessionExercises.where("sessionId").equals(sessionId).toArray();
  return [...new Set(linhas.map((l) => l.exerciseId))];
}

/** Apaga a sessão e o que pende dela, como o cascade do banco fazia. */
async function deleteSessionCascade(sessionId: string) {
  const linhas = await db.sessionExercises.where("sessionId").equals(sessionId).primaryKeys();
  if (linhas.length) await db.sets.where("sessionExerciseId").anyOf(linhas).delete();
  await db.sessionExercises.bulkDelete(linhas);
  await db.personalRecords.where("sessionId").equals(sessionId).delete();
  await db.sessions.delete(sessionId);
}

/* ------------------------------------------------------------------ *
 * Sessão
 * ------------------------------------------------------------------ */

/**
 * Cria a sessão e copia para ela a prescrição vigente do dia. Com uma
 * sessão já em andamento não cria outra: leva até ela.
 */
export async function startSession(_prev: SessionActionState, formData: FormData): Promise<SessionActionState> {
  const parsed = startSessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Escolha um dia do programa." };

  try {
    const destino = await db.transaction(
      "rw",
      [db.sessions, db.sessionExercises, db.routines, db.routineDays, db.routineExercises, db.customExercises],
      async (): Promise<SessionActionState> => {
        const aberta = await openSessionId();
        if (aberta) return { redirectTo: `/executar/${aberta}` };

        const dia = await db.routineDays.get(parsed.data.routineDayId);
        const rotina = dia ? await db.routines.get(dia.routineId) : undefined;
        if (!dia || !rotina) return { error: "Dia do programa não encontrado." };
        if (rotina.archivedAt) return { error: "Programa arquivado. Desarquive antes de treinar." };

        const prescricoes = (await db.routineExercises.where("routineDayId").equals(dia.id).toArray()).sort(
          (a, b) => a.position - b.position || a.id.localeCompare(b.id),
        );

        const id = newId();
        const agora = nowIso();
        await db.sessions.add({
          id,
          routineId: rotina.id,
          routineDayId: dia.id,
          titleSnapshot: `${rotina.name} · ${dia.name}`.slice(0, 130),
          status: "em_andamento",
          startedAt: agora,
          finishedAt: null,
          perceivedEffort: null,
          notes: null,
        });

        const linhas: SessionExercise[] = [];
        for (const [i, p] of prescricoes.entries()) {
          const ex = await findExercise(p.exerciseId);
          linhas.push({
            id: newId(),
            sessionId: id,
            exerciseId: p.exerciseId,
            routineExerciseId: p.id,
            position: i,
            targetSets: p.targetSets,
            repMin: p.repMin,
            repMax: p.repMax,
            targetRir: p.targetRir,
            restSeconds: p.restSeconds,
            // Resolvido agora: mudar o incremento depois não muda o que valia hoje.
            loadStepKg: resolveLoadStep(p.loadStepKgOverride, ex?.loadStepKg),
            notes: p.notes,
            createdAt: agora,
          });
        }
        await db.sessionExercises.bulkAdd(linhas);
        return { redirectTo: `/executar/${id}` };
      },
    );
    return destino;
  } catch {
    return { error: "Não foi possível iniciar o treino. Tente de novo." };
  }
}

/** Exige pelo menos uma série: treino concluído sem nada feito é ruído no histórico. */
export async function finishSession(_prev: SessionActionState, formData: FormData): Promise<SessionActionState> {
  const parsed = finishSessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const id = parsed.data.id;

  const linhas = await db.sessionExercises.where("sessionId").equals(id).primaryKeys();
  const series = linhas.length ? await db.sets.where("sessionExerciseId").anyOf(linhas).count() : 0;
  if (!series) return { error: "Registre pelo menos uma série, ou descarte o treino." };

  try {
    await db.transaction("rw", [db.sessions, db.sessionExercises, db.sets, db.personalRecords], async () => {
      const sessao = await db.sessions.get(id);
      if (!sessao || sessao.status !== "em_andamento") return;
      await db.sessions.update(id, {
        status: "concluida",
        finishedAt: nowIso(),
        perceivedEffort: parsed.data.perceivedEffort,
        notes: parsed.data.notes || null,
      });
      await recomputeRecords(await exerciseIdsOf(id));
    });
  } catch {
    return { error: "Não foi possível concluir o treino. Tente de novo." };
  }

  return { redirectTo: `/executar/${id}/resumo` };
}

/** Apaga de verdade, só em andamento. Treino concluído sai pelo histórico. */
export async function discardSession(formData: FormData): Promise<void> {
  const parsed = sessionIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  await db.transaction("rw", [db.sessions, db.sessionExercises, db.sets, db.personalRecords], async () => {
    if ((await db.sessions.get(parsed.data.id))?.status !== "em_andamento") return;
    await deleteSessionCascade(parsed.data.id);
  });
}

/* ------------------------------------------------------------------ *
 * Exercícios da sessão
 * ------------------------------------------------------------------ */

/** Exercício fora do plano: entra sem prescrição, com descanso e incremento do catálogo. */
export async function addSessionExercise(formData: FormData): Promise<SessionActionState> {
  const parsed = addSessionExerciseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Exercício inválido." };

  const ex = await findExercise(parsed.data.exerciseId);
  if (!ex) return { error: "Exercício não encontrado." };

  try {
    await db.transaction("rw", db.sessionExercises, async () => {
      const existentes = await db.sessionExercises.where("sessionId").equals(parsed.data.sessionId).toArray();
      const proxima = existentes.length === 0 ? 0 : Math.max(...existentes.map((e) => e.position)) + 1;
      await db.sessionExercises.add({
        id: newId(),
        sessionId: parsed.data.sessionId,
        exerciseId: ex.id,
        routineExerciseId: null,
        position: proxima,
        targetSets: null,
        repMin: null,
        repMax: null,
        targetRir: null,
        restSeconds: Math.min(600, Math.max(15, ex.defaultRestSeconds)),
        loadStepKg: resolveLoadStep(null, ex.loadStepKg),
        notes: null,
        createdAt: nowIso(),
      });
    });
  } catch {
    return { error: "Não foi possível adicionar o exercício. Tente de novo." };
  }
  return {};
}

/** Só sem séries: serve para desfazer um exercício acrescentado por engano. */
export async function removeSessionExercise(formData: FormData): Promise<SessionActionState> {
  const parsed = sessionIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Exercício inválido." };

  if ((await db.sets.where("sessionExerciseId").equals(parsed.data.id).count()) > 0) {
    return { error: "Remova as séries registradas antes." };
  }
  await db.sessionExercises.delete(parsed.data.id);
  return {};
}

/* ------------------------------------------------------------------ *
 * Séries
 * ------------------------------------------------------------------ */

/**
 * Corrigir uma série de treino concluído muda os recordes daquele
 * exercício. Em treino em andamento não faz nada: os recordes são
 * recalculados ao concluir.
 */
async function recalcularSeConcluida(sessionExerciseId: string) {
  const linha = await db.sessionExercises.get(sessionExerciseId);
  if (linha && (await isFinished(linha.sessionId))) await recomputeRecords([linha.exerciseId]);
}

/**
 * Registra ou corrige uma série. `put` pelo id gerado no cliente: a mesma
 * chamada repetida cai no mesmo registro.
 */
export async function saveSet(formData: FormData): Promise<SessionActionState> {
  const parsed = saveSetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const primeiro = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
    return { error: primeiro ?? "Valores inválidos na série." };
  }
  const s = parsed.data;

  try {
    await db.transaction("rw", [db.sessions, db.sessionExercises, db.sets, db.personalRecords], async () => {
      const atual = await db.sets.get(s.id);
      await db.sets.put({
        id: s.id,
        sessionExerciseId: s.sessionExerciseId,
        setNumber: s.setNumber,
        kind: s.kind,
        weightKg: s.weightKg === null ? null : toKg(s.weightKg),
        reps: s.reps,
        rir: s.rir,
        // Corrigir não muda quando a série foi feita; série nova no histórico
        // recebe a data do treino, não a de hoje.
        completedAt: atual?.completedAt ?? s.completedAt ?? nowIso(),
      });
      await recalcularSeConcluida(s.sessionExerciseId);
    });
  } catch {
    return { error: "A série não foi salva. Toque para tentar de novo." };
  }
  return {};
}

/** Remove e renumera as que sobraram, na mesma transação. */
export async function deleteSet(formData: FormData): Promise<SessionActionState> {
  const parsed = setIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Série inválida." };

  try {
    await db.transaction("rw", [db.sessions, db.sessionExercises, db.sets, db.personalRecords], async () => {
      const serie = await db.sets.get(parsed.data.id);
      if (!serie) return;
      await db.sets.delete(serie.id);

      const restantes = (await db.sets.where("sessionExerciseId").equals(serie.sessionExerciseId).toArray()).sort(
        (a, b) => a.setNumber - b.setNumber || a.completedAt.localeCompare(b.completedAt),
      );
      for (const [i, r] of restantes.entries()) {
        if (r.setNumber !== i + 1) await db.sets.update(r.id, { setNumber: i + 1 });
      }
      await recalcularSeConcluida(serie.sessionExerciseId);
    });
  } catch {
    return { error: "Não foi possível remover a série. Tente de novo." };
  }
  return {};
}

/* ------------------------------------------------------------------ *
 * Histórico: correção de treino concluído
 * ------------------------------------------------------------------ */

/** Um dia é o teto: mais que isso é quase certamente data digitada errada. */
const DURACAO_MAXIMA_MS = 24 * 60 * 60 * 1000;

/**
 * Data, horário, esforço e observação. O usuário digita no fuso dele.
 * Fim antes do início = o treino atravessou a meia-noite. Mudar o início
 * desloca as séries pelo mesmo tanto: o horário delas ordena os recordes.
 */
export async function updateSession(_prev: SessionActionState, formData: FormData): Promise<SessionActionState> {
  const parsed = updateSessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const fuso = (await db.profile.get("eu"))?.timezone ?? "America/Sao_Paulo";
  const inicio = zonedToUtc(parsed.data.date, parsed.data.start, fuso);
  let fim = zonedToUtc(parsed.data.date, parsed.data.end, fuso);
  if (fim.getTime() <= inicio.getTime()) fim = new Date(fim.getTime() + 24 * 60 * 60 * 1000);

  if (fim.getTime() - inicio.getTime() > DURACAO_MAXIMA_MS) {
    return { fieldErrors: { end: ["O treino não pode durar mais de 24 horas."] } };
  }
  if (fim.getTime() > Date.now() + 5 * 60 * 1000) {
    return { fieldErrors: { end: ["O fim do treino não pode estar no futuro."] } };
  }

  try {
    const erro = await db.transaction(
      "rw",
      [db.sessions, db.sessionExercises, db.sets, db.personalRecords],
      async (): Promise<string | null> => {
        const sessao = await db.sessions.get(parsed.data.id);
        if (!sessao) return "Treino não encontrado.";
        if (sessao.status !== "concluida") return "Conclua o treino antes de corrigir pelo histórico.";

        await db.sessions.update(sessao.id, {
          startedAt: inicio.toISOString(),
          finishedAt: fim.toISOString(),
          perceivedEffort: parsed.data.perceivedEffort,
          notes: parsed.data.notes || null,
        });

        const delta = inicio.getTime() - new Date(sessao.startedAt).getTime();
        if (delta !== 0) {
          const linhas = await db.sessionExercises.where("sessionId").equals(sessao.id).primaryKeys();
          if (linhas.length) {
            await db.sets
              .where("sessionExerciseId")
              .anyOf(linhas)
              .modify((s) => {
                s.completedAt = new Date(new Date(s.completedAt).getTime() + delta).toISOString();
              });
          }
          await recomputeRecords(await exerciseIdsOf(sessao.id));
        }
        return null;
      },
    );
    if (erro) return { error: erro };
  } catch {
    return { error: ERRO_GRAVAR };
  }
  return { ok: true };
}

/** Remove um exercício de treino concluído, com as séries, após confirmação. */
export async function removeHistoryExercise(formData: FormData): Promise<SessionActionState> {
  const parsed = sessionIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Exercício inválido." };

  try {
    await db.transaction("rw", [db.sessions, db.sessionExercises, db.sets, db.personalRecords], async () => {
      const linha = await db.sessionExercises.get(parsed.data.id);
      if (!linha) return;
      await db.sets.where("sessionExerciseId").equals(linha.id).delete();
      await db.sessionExercises.delete(linha.id);
      await recomputeRecords([linha.exerciseId]);
    });
  } catch {
    return { error: "Não foi possível remover o exercício. Tente de novo." };
  }
  return {};
}

/** Exclui um treino concluído e recalcula os recordes sem ele. */
export async function deleteSession(_prev: SessionActionState, formData: FormData): Promise<SessionActionState> {
  const parsed = sessionIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Treino inválido." };

  try {
    await db.transaction("rw", [db.sessions, db.sessionExercises, db.sets, db.personalRecords], async () => {
      // Lidos antes: depois de apagar, o vínculo some.
      const exercicios = await exerciseIdsOf(parsed.data.id);
      await deleteSessionCascade(parsed.data.id);
      await recomputeRecords(exercicios);
    });
  } catch {
    return { error: "Não foi possível excluir o treino. Tente de novo." };
  }
  return { redirectTo: "/historico" };
}
