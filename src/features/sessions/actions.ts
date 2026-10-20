"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/core/auth/server";
import { requireUser } from "@/core/auth/session";
import { resolveLoadStep } from "@/core/domain/load-step";
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
import { zonedToUtc } from "@/core/utils/date";

/** Violação de unicidade no Postgres. Aqui, só o índice de sessão aberta. */
const UNIQUE_VIOLATION = "23505";

async function openSessionId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("workout_sessions").select("id").eq("status", "em_andamento").maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** O que muda quando uma sessão começa ou termina. */
function revalidar(routineId?: string | null) {
  revalidatePath("/inicio");
  revalidatePath("/treinos");
  if (routineId) revalidatePath(`/treinos/${routineId}`);
}

/* ------------------------------------------------------------------ *
 * Sessão
 * ------------------------------------------------------------------ */

type DiaParaIniciar = {
  id: string;
  name: string;
  routine_id: string;
  routines: { name: string; archived_at: string | null } | null;
  routine_exercises:
    | {
        id: string;
        exercise_id: string;
        position: number;
        target_sets: number;
        rep_min: number;
        rep_max: number;
        target_rir: number | null;
        rest_seconds: number;
        load_step_kg_override: string | null;
        notes: string | null;
        exercises: { load_step_kg: string } | null;
      }[]
    | null;
};

/**
 * Cria a sessão e copia a prescrição vigente do dia para ela.
 *
 * Com uma sessão já em andamento, não cria outra: leva até ela. O índice
 * parcial único é a trava no banco; a checagem aqui é só para o caminho
 * comum não depender de erro.
 *
 * São duas inserções sem transação, como em `duplicateRoutine`. Se a
 * segunda falhar, apaga a sessão criada — o cascade leva o resto.
 */
export async function startSession(_prev: SessionActionState, formData: FormData): Promise<SessionActionState> {
  const user = await requireUser();
  const parsed = startSessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Escolha um dia do programa." };

  const aberta = await openSessionId();
  if (aberta) redirect(`/executar/${aberta}`);

  const supabase = await createClient();
  const { data } = await supabase
    .from("routine_days")
    .select(
      `id, name, routine_id,
       routines ( name, archived_at ),
       routine_exercises ( id, exercise_id, position, target_sets, rep_min, rep_max,
                           target_rir, rest_seconds, load_step_kg_override, notes,
                           exercises ( load_step_kg ) )`,
    )
    .eq("id", parsed.data.routineDayId)
    .maybeSingle();

  const dia = data as unknown as DiaParaIniciar | null;
  if (!dia?.routines) return { error: "Dia do programa não encontrado." };
  if (dia.routines.archived_at) return { error: "Programa arquivado. Desarquive antes de treinar." };

  const { data: criada, error } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: user.id,
      routine_id: dia.routine_id,
      routine_day_id: dia.id,
      title_snapshot: `${dia.routines.name} · ${dia.name}`.slice(0, 130),
    })
    .select("id")
    .single();

  if (error?.code === UNIQUE_VIOLATION) {
    // Outra aba abriu uma sessão entre a checagem e a inserção.
    const outra = await openSessionId();
    if (outra) redirect(`/executar/${outra}`);
  }
  if (error || !criada) return { error: "Não foi possível iniciar o treino. Tente de novo." };

  const prescricoes = [...(dia.routine_exercises ?? [])]
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .map((p, i) => ({
      session_id: criada.id,
      exercise_id: p.exercise_id,
      routine_exercise_id: p.id,
      position: i,
      target_sets: p.target_sets,
      rep_min: p.rep_min,
      rep_max: p.rep_max,
      target_rir: p.target_rir,
      rest_seconds: p.rest_seconds,
      // Resolvido agora: mudar o incremento depois não muda o que valia hoje.
      load_step_kg: resolveLoadStep(p.load_step_kg_override, p.exercises?.load_step_kg).toFixed(2),
      notes: p.notes,
    }));

  if (prescricoes.length > 0) {
    const { error: erroExercicios } = await supabase.from("session_exercises").insert(prescricoes);
    if (erroExercicios) {
      await supabase.from("workout_sessions").delete().eq("id", criada.id);
      return { error: "Não foi possível preparar os exercícios do treino. Tente de novo." };
    }
  }

  revalidar(dia.routine_id);
  redirect(`/executar/${criada.id}`);
}

/** Exige pelo menos uma série: treino concluído sem nada feito é ruído no histórico. */
export async function finishSession(_prev: SessionActionState, formData: FormData): Promise<SessionActionState> {
  const user = await requireUser();
  const parsed = finishSessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();

  const { count } = await supabase
    .from("sets")
    .select("id, session_exercises!inner ( session_id )", { count: "exact", head: true })
    .eq("session_exercises.session_id", parsed.data.id);

  if (!count) return { error: "Registre pelo menos uma série, ou descarte o treino." };

  const { data, error } = await supabase
    .from("workout_sessions")
    .update({
      status: "concluida",
      finished_at: new Date().toISOString(),
      perceived_effort: parsed.data.perceivedEffort,
      notes: parsed.data.notes || null,
    })
    .eq("id", parsed.data.id)
    .eq("status", "em_andamento")
    .select("routine_id")
    .maybeSingle();

  if (error) return { error: "Não foi possível concluir o treino. Tente de novo." };

  // Depois de concluir, para a consulta já enxergar esta sessão. Recorde é
  // derivado: se falhar, o treino continua concluído.
  const { data: exercicios } = await supabase
    .from("session_exercises")
    .select("exercise_id")
    .eq("session_id", parsed.data.id);
  await recomputeRecords(
    user.id,
    [...new Set(((exercicios ?? []) as { exercise_id: string }[]).map((e) => e.exercise_id))],
  );

  revalidar((data as { routine_id: string | null } | null)?.routine_id);
  revalidatePath("/exercicios", "layout");
  redirect(`/executar/${parsed.data.id}/resumo`);
}

/**
 * Apaga de verdade. O RLS só permite enquanto está em andamento: treino
 * concluído é histórico. O cascade leva exercícios e séries.
 */
export async function discardSession(formData: FormData) {
  await requireUser();
  const parsed = sessionIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("workout_sessions")
    .delete()
    .eq("id", parsed.data.id)
    .eq("status", "em_andamento")
    .select("routine_id")
    .maybeSingle();

  revalidar((data as { routine_id: string | null } | null)?.routine_id);
  redirect("/inicio");
}

/* ------------------------------------------------------------------ *
 * Exercícios da sessão
 * ------------------------------------------------------------------ */

/** Exercício fora do plano: entra sem prescrição, com descanso e incremento do catálogo. */
export async function addSessionExercise(formData: FormData): Promise<SessionActionState> {
  await requireUser();
  const parsed = addSessionExerciseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Exercício inválido." };

  const supabase = await createClient();
  const [{ data: existentes }, { data: exercicio }] = await Promise.all([
    supabase.from("session_exercises").select("position").eq("session_id", parsed.data.sessionId),
    supabase
      .from("exercises")
      .select("default_rest_seconds, load_step_kg")
      .eq("id", parsed.data.exerciseId)
      .maybeSingle(),
  ]);

  const ex = exercicio as { default_rest_seconds: number; load_step_kg: string } | null;
  if (!ex) return { error: "Exercício não encontrado." };

  const posicoes = (existentes ?? []) as { position: number }[];
  const proxima = posicoes.length === 0 ? 0 : Math.max(...posicoes.map((e) => e.position)) + 1;

  const { error } = await supabase.from("session_exercises").insert({
    session_id: parsed.data.sessionId,
    exercise_id: parsed.data.exerciseId,
    position: proxima,
    rest_seconds: Math.min(600, Math.max(15, ex.default_rest_seconds)),
    load_step_kg: resolveLoadStep(null, ex.load_step_kg).toFixed(2),
  });

  if (error) return { error: "Não foi possível adicionar o exercício. Tente de novo." };

  revalidatePath(`/executar/${parsed.data.sessionId}`);
  revalidatePath(`/historico/${parsed.data.sessionId}`);
  return {};
}

/** Só sem séries: serve para desfazer um exercício acrescentado por engano. */
export async function removeSessionExercise(formData: FormData): Promise<SessionActionState> {
  await requireUser();
  const parsed = sessionIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Exercício inválido." };

  const supabase = await createClient();
  const { data } = await supabase
    .from("session_exercises")
    .select("session_id, sets ( id )")
    .eq("id", parsed.data.id)
    .maybeSingle();

  const linha = data as { session_id: string; sets: { id: string }[] | null } | null;
  if (!linha) return { error: "Exercício não encontrado." };
  if ((linha.sets ?? []).length > 0) return { error: "Remova as séries registradas antes." };

  const { error } = await supabase.from("session_exercises").delete().eq("id", parsed.data.id);
  if (error) return { error: "Não foi possível remover o exercício. Tente de novo." };

  revalidatePath(`/executar/${linha.session_id}`);
  return {};
}

/* ------------------------------------------------------------------ *
 * Séries
 *
 * Não revalidam a página de execução: o cliente já mostra o valor novo, e
 * redesenhar a tela inteira a cada série seria custo sem ganho entre uma
 * série e outra.
 * ------------------------------------------------------------------ */

/**
 * Registra ou corrige uma série. `upsert` pelo id gerado no cliente: a
 * mesma chamada repetida cai na mesma linha, e é isso que torna seguro
 * tentar de novo depois de um timeout.
 */
export async function saveSet(formData: FormData): Promise<SessionActionState> {
  const user = await requireUser();
  const parsed = saveSetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const primeiro = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
    return { error: primeiro ?? "Valores inválidos na série." };
  }

  const s = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("sets").upsert(
    {
      id: s.id,
      session_exercise_id: s.sessionExerciseId,
      set_number: s.setNumber,
      kind: s.kind,
      // String com duas casas: `numeric` recebe exato, sem passar por float.
      weight_kg: s.weightKg === null ? null : s.weightKg.toFixed(2),
      reps: s.reps,
      rir: s.rir,
      ...(s.completedAt ? { completed_at: s.completedAt } : {}),
    },
    { onConflict: "id" },
  );

  if (error) return { error: "A série não foi salva. Toque para tentar de novo." };

  await recalcularSeConcluida(user.id, s.sessionExerciseId);
  return {};
}

/**
 * Corrigir uma série de treino concluído muda os recordes daquele
 * exercício. Na execução a sessão ainda está em andamento e isto não faz
 * nada além de uma consulta: os recordes são recalculados ao concluir.
 */
async function recalcularSeConcluida(userId: string, sessionExerciseId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("session_exercises")
    .select("exercise_id, workout_sessions!inner ( status )")
    .eq("id", sessionExerciseId)
    .maybeSingle();

  const linha = data as { exercise_id: string; workout_sessions: { status: string } | null } | null;
  if (linha?.workout_sessions?.status === "concluida") await recomputeRecords(userId, [linha.exercise_id]);
}

/**
 * Remove e renumera as que sobraram num `upsert` só, pelo mesmo motivo da
 * reordenação de dias: sequência de updates deixaria a numeração pela
 * metade se a conexão caísse no meio.
 */
export async function deleteSet(formData: FormData): Promise<SessionActionState> {
  const user = await requireUser();
  const parsed = setIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Série inválida." };

  const supabase = await createClient();
  const { data } = await supabase.from("sets").select("session_exercise_id").eq("id", parsed.data.id).maybeSingle();
  const pai = (data as { session_exercise_id: string } | null)?.session_exercise_id;
  if (!pai) return {};

  const { error } = await supabase.from("sets").delete().eq("id", parsed.data.id);
  if (error) return { error: "Não foi possível remover a série. Tente de novo." };

  const { data: restantes } = await supabase
    .from("sets")
    .select("id, session_exercise_id, set_number, reps, completed_at")
    .eq("session_exercise_id", pai)
    .order("set_number")
    .order("completed_at");

  type Linha = { id: string; session_exercise_id: string; set_number: number; reps: number; completed_at: string };
  const linhas = ((restantes ?? []) as Linha[])
    .map((l, i) => ({ id: l.id, session_exercise_id: l.session_exercise_id, reps: l.reps, set_number: i + 1 }));

  if (linhas.length > 0) await supabase.from("sets").upsert(linhas, { onConflict: "id" });

  await recalcularSeConcluida(user.id, pai);
  return {};
}

/* ------------------------------------------------------------------ *
 * Histórico: correção de treino concluído
 *
 * Cada correção recalcula os recordes dos exercícios afetados. Volume,
 * sequência, veredito e estagnação não precisam: são calculados das
 * séries na hora em que alguém olha.
 * ------------------------------------------------------------------ */

/** Exercícios de uma sessão, para saber o que recalcular. */
async function exerciseIdsOf(sessionId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("session_exercises").select("exercise_id").eq("session_id", sessionId);
  return [...new Set(((data ?? []) as { exercise_id: string }[]).map((e) => e.exercise_id))];
}

/** Um dia é o teto: mais que isso é quase certamente data digitada errada. */
const DURACAO_MAXIMA_MS = 24 * 60 * 60 * 1000;

/**
 * Data, horário, esforço e observação.
 *
 * O usuário digita no horário dele; o banco guarda UTC. Fim antes do
 * início significa que o treino atravessou a meia-noite.
 *
 * Mudar o início desloca as séries junto, pelo mesmo tanto: o horário de
 * cada série ordena os recordes (quem chegou primeiro) e não pode ficar
 * no dia antigo.
 */
export async function updateSession(_prev: SessionActionState, formData: FormData): Promise<SessionActionState> {
  const user = await requireUser();
  const parsed = updateSessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const fuso = user.profile?.timezone ?? "America/Sao_Paulo";
  const inicio = zonedToUtc(parsed.data.date, parsed.data.start, fuso);
  let fim = zonedToUtc(parsed.data.date, parsed.data.end, fuso);
  if (fim.getTime() <= inicio.getTime()) fim = new Date(fim.getTime() + 24 * 60 * 60 * 1000);

  if (fim.getTime() - inicio.getTime() > DURACAO_MAXIMA_MS) {
    return { fieldErrors: { end: ["O treino não pode durar mais de 24 horas."] } };
  }
  if (fim.getTime() > Date.now() + 5 * 60 * 1000) {
    return { fieldErrors: { end: ["O fim do treino não pode estar no futuro."] } };
  }

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("workout_sessions")
    .select("started_at, status")
    .eq("id", parsed.data.id)
    .maybeSingle();

  const sessao = atual as { started_at: string; status: string } | null;
  if (!sessao) return { error: "Treino não encontrado." };
  if (sessao.status !== "concluida") return { error: "Conclua o treino antes de corrigir pelo histórico." };

  const { error } = await supabase
    .from("workout_sessions")
    .update({
      started_at: inicio.toISOString(),
      finished_at: fim.toISOString(),
      perceived_effort: parsed.data.perceivedEffort,
      notes: parsed.data.notes || null,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: "Não foi possível salvar. Tente de novo." };

  const delta = inicio.getTime() - new Date(sessao.started_at).getTime();
  if (delta !== 0) {
    const { data: series } = await supabase
      .from("sets")
      .select("id, session_exercise_id, set_number, reps, completed_at, session_exercises!inner ( session_id )")
      .eq("session_exercises.session_id", parsed.data.id);

    type Linha = { id: string; session_exercise_id: string; set_number: number; reps: number; completed_at: string };
    const deslocadas = ((series ?? []) as unknown as Linha[]).map((l) => ({
      id: l.id,
      session_exercise_id: l.session_exercise_id,
      set_number: l.set_number,
      reps: l.reps,
      completed_at: new Date(new Date(l.completed_at).getTime() + delta).toISOString(),
    }));
    // Upsert numa instrução só, pelo mesmo motivo da renumeração.
    if (deslocadas.length > 0) await supabase.from("sets").upsert(deslocadas, { onConflict: "id" });

    await recomputeRecords(user.id, await exerciseIdsOf(parsed.data.id));
  }

  revalidatePath(`/historico/${parsed.data.id}`);
  return { ok: true };
}

/**
 * Remove um exercício de treino concluído, com as séries. Na execução só
 * se remove exercício sem série (removeSessionExercise); aqui o usuário
 * confirma em dois toques que quer apagar o que registrou.
 */
export async function removeHistoryExercise(formData: FormData): Promise<SessionActionState> {
  const user = await requireUser();
  const parsed = sessionIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Exercício inválido." };

  const supabase = await createClient();
  const { data } = await supabase
    .from("session_exercises")
    .select("session_id, exercise_id")
    .eq("id", parsed.data.id)
    .maybeSingle();

  const linha = data as { session_id: string; exercise_id: string } | null;
  if (!linha) return { error: "Exercício não encontrado." };

  const { error } = await supabase.from("session_exercises").delete().eq("id", parsed.data.id);
  if (error) return { error: "Não foi possível remover o exercício. Tente de novo." };

  await recomputeRecords(user.id, [linha.exercise_id]);
  revalidatePath(`/historico/${linha.session_id}`);
  return {};
}

/**
 * Exclui um treino concluído. Depende da 0008, que liberou o DELETE para
 * qualquer sessão do usuário. Os exercícios são lidos antes de apagar,
 * porque o cascade leva o vínculo junto.
 */
export async function deleteSession(_prev: SessionActionState, formData: FormData): Promise<SessionActionState> {
  const user = await requireUser();
  const parsed = sessionIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Treino inválido." };

  const exercicios = await exerciseIdsOf(parsed.data.id);

  const supabase = await createClient();
  const { data } = await supabase
    .from("workout_sessions")
    .delete()
    .eq("id", parsed.data.id)
    .select("routine_id")
    .maybeSingle();

  // Nada apagado: sessão de outro, já apagada, ou a 0008 ainda não rodou —
  // o RLS antigo recusa em silêncio, sem erro.
  if (!data) return { error: "Não foi possível excluir o treino. Tente de novo." };

  await recomputeRecords(user.id, exercicios);
  revalidar((data as { routine_id: string | null } | null)?.routine_id);
  revalidatePath("/historico");
  redirect("/historico");
}
