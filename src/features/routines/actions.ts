"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/core/auth/server";
import { requireUser } from "@/core/auth/session";
import { defaultDayName } from "./labels";
import {
  createRoutineSchema,
  renameRoutineSchema,
  routineIdSchema,
  daySchema,
  addDaySchema,
  addExerciseSchema,
  prescriptionSchema,
  reorderSchema,
  type RoutineActionState,
} from "./schemas";

/** Prescrição inicial ao trazer um exercício do catálogo para o dia. */
const PRESCRICAO_PADRAO = { targetSets: 3, repMin: 8, repMax: 12, targetRir: 2 };

function revalidar(routineId?: string) {
  revalidatePath("/treinos");
  if (routineId) {
    revalidatePath(`/treinos/${routineId}`);
    revalidatePath(`/treinos/${routineId}/editar`);
  }
}

/** Sobe do dia para a rotina, para saber o que revalidar. */
async function routineIdOfDay(dayId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("routine_days").select("routine_id").eq("id", dayId).maybeSingle();
  return (data as { routine_id: string } | null)?.routine_id ?? null;
}

async function routineIdOfPrescription(prescriptionId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("routine_exercises")
    .select("routine_days ( routine_id )")
    .eq("id", prescriptionId)
    .maybeSingle();
  const row = data as { routine_days: { routine_id: string } | null } | null;
  return row?.routine_days?.routine_id ?? null;
}

/* ------------------------------------------------------------------ *
 * Programa
 * ------------------------------------------------------------------ */

export async function createRoutine(
  _prev: RoutineActionState,
  formData: FormData,
): Promise<RoutineActionState> {
  const user = await requireUser();
  const parsed = createRoutineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { data: criada, error } = await supabase
    .from("routines")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
    })
    .select("id")
    .single();

  if (error || !criada) return { error: "Não foi possível criar o programa. Tente de novo." };

  const dias = Array.from({ length: parsed.data.dayCount }, (_, i) => ({
    routine_id: criada.id,
    name: defaultDayName(i),
    position: i,
  }));

  const { error: erroDias } = await supabase.from("routine_days").insert(dias);
  if (erroDias) {
    // Programa sem dia nenhum não serve para nada: melhor desfazer.
    await supabase.from("routines").delete().eq("id", criada.id);
    return { error: "Não foi possível criar os dias do programa. Tente de novo." };
  }

  revalidar(criada.id);
  redirect(`/treinos/${criada.id}/editar`);
}

export async function renameRoutine(
  _prev: RoutineActionState,
  formData: FormData,
): Promise<RoutineActionState> {
  await requireUser();
  const parsed = renameRoutineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase
    .from("routines")
    .update({ name: parsed.data.name, description: parsed.data.description || null })
    .eq("id", parsed.data.id);

  if (error) return { error: "Não foi possível salvar. Tente de novo." };

  revalidar(parsed.data.id);
  return {};
}

/**
 * Só uma rotina ativa por usuário, garantido por índice parcial único. Por
 * isso desativa as outras antes: ativar primeiro violaria o índice.
 */
export async function activateRoutine(formData: FormData) {
  const user = await requireUser();
  const parsed = routineIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase
    .from("routines")
    .update({ is_active: false })
    .eq("user_id", user.id)
    .eq("is_active", true)
    .neq("id", parsed.data.id);

  await supabase.from("routines").update({ is_active: true }).eq("id", parsed.data.id).is("archived_at", null);

  revalidar(parsed.data.id);
}

/** Exclusão lógica: o histórico da Fase 6 vai apontar para estes dias. */
export async function archiveRoutine(formData: FormData) {
  await requireUser();
  const parsed = routineIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const supabase = await createClient();
  // is_active vai junto: o CHECK da 0005 proíbe arquivada e ativa ao mesmo tempo.
  await supabase
    .from("routines")
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq("id", parsed.data.id);

  revalidar(parsed.data.id);
}

export async function unarchiveRoutine(formData: FormData) {
  await requireUser();
  const parsed = routineIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase.from("routines").update({ archived_at: null }).eq("id", parsed.data.id);

  revalidar(parsed.data.id);
}

/**
 * Duplicar são três inserções e o supabase-js não dá transação. Se a
 * segunda ou a terceira falhar, apaga a rotina criada — o cascade leva os
 * filhos junto. Mesmo padrão de `createCustomExercise`, na Fase 2.
 */
export async function duplicateRoutine(formData: FormData) {
  const user = await requireUser();
  const parsed = routineIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const supabase = await createClient();

  const { data: origem } = await supabase
    .from("routines")
    .select(
      `name, description,
       routine_days ( name, position, suggested_weekday, notes,
         routine_exercises ( exercise_id, position, target_sets, rep_min, rep_max,
                             target_rir, rest_seconds, load_step_kg_override,
                             superset_group, notes ) )`,
    )
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (!origem) return;

  type DiaOrigem = {
    name: string;
    position: number;
    suggested_weekday: number | null;
    notes: string | null;
    routine_exercises: Record<string, unknown>[] | null;
  };
  const fonte = origem as unknown as { name: string; description: string | null; routine_days: DiaOrigem[] | null };

  const { data: copia, error } = await supabase
    .from("routines")
    .insert({
      user_id: user.id,
      name: `${fonte.name} (cópia)`.slice(0, 60),
      description: fonte.description,
    })
    .select("id")
    .single();

  if (error || !copia) return;

  const diasOrigem = fonte.routine_days ?? [];
  if (diasOrigem.length === 0) {
    revalidar(copia.id);
    redirect(`/treinos/${copia.id}`);
  }

  const { data: diasNovos, error: erroDias } = await supabase
    .from("routine_days")
    .insert(
      diasOrigem.map((d) => ({
        routine_id: copia.id,
        name: d.name,
        position: d.position,
        suggested_weekday: d.suggested_weekday,
        notes: d.notes,
      })),
    )
    .select("id, position");

  if (erroDias || !diasNovos) {
    await supabase.from("routines").delete().eq("id", copia.id);
    return;
  }

  // A ordem de retorno do insert não é garantida; `position` é o que liga
  // o dia novo ao original, e dentro da cópia ela não se repete.
  const porPosicao = new Map((diasNovos as { id: string; position: number }[]).map((d) => [d.position, d.id]));

  const prescricoes = diasOrigem.flatMap((d) => {
    const novoDia = porPosicao.get(d.position);
    if (!novoDia) return [];
    return (d.routine_exercises ?? []).map((e) => ({ ...e, routine_day_id: novoDia }));
  });

  if (prescricoes.length > 0) {
    const { error: erroPrescricoes } = await supabase.from("routine_exercises").insert(prescricoes);
    if (erroPrescricoes) {
      await supabase.from("routines").delete().eq("id", copia.id);
      return;
    }
  }

  revalidar(copia.id);
  redirect(`/treinos/${copia.id}`);
}

/* ------------------------------------------------------------------ *
 * Dias
 * ------------------------------------------------------------------ */

export async function addDay(formData: FormData) {
  await requireUser();
  const parsed = addDaySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const supabase = await createClient();
  const { data: existentes } = await supabase
    .from("routine_days")
    .select("position")
    .eq("routine_id", parsed.data.routineId);

  const posicoes = (existentes ?? []) as { position: number }[];
  const proxima = posicoes.length === 0 ? 0 : Math.max(...posicoes.map((d) => d.position)) + 1;

  await supabase.from("routine_days").insert({
    routine_id: parsed.data.routineId,
    name: defaultDayName(posicoes.length),
    position: proxima,
  });

  revalidar(parsed.data.routineId);
}

export async function updateDay(_prev: RoutineActionState, formData: FormData): Promise<RoutineActionState> {
  await requireUser();
  const parsed = daySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase
    .from("routine_days")
    .update({
      name: parsed.data.name,
      suggested_weekday: parsed.data.suggestedWeekday,
      notes: parsed.data.notes || null,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: "Não foi possível salvar o dia. Tente de novo." };

  revalidar((await routineIdOfDay(parsed.data.id)) ?? undefined);
  return {};
}

export async function removeDay(formData: FormData) {
  await requireUser();
  const parsed = routineIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const routineId = await routineIdOfDay(parsed.data.id);

  const supabase = await createClient();
  // Cascade leva as prescrições do dia. Nenhuma sessão aponta para cá ainda.
  await supabase.from("routine_days").delete().eq("id", parsed.data.id);

  revalidar(routineId ?? undefined);
}

/**
 * Reordenação manda a lista inteira e grava num `upsert` só, que o
 * PostgREST executa como uma instrução. Sequência de updates deixaria a
 * ordem pela metade se a conexão caísse no meio — e ela cai, na academia.
 */
export async function reorderDays(formData: FormData) {
  await requireUser();
  const parsed = reorderSchema.safeParse({ ids: formData.getAll("ids").map(String) });
  if (!parsed.success) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("routine_days")
    .select("id, routine_id, name")
    .in("id", parsed.data.ids);

  const atuais = (data ?? []) as { id: string; routine_id: string; name: string }[];
  if (atuais.length !== parsed.data.ids.length) return;

  const porId = new Map(atuais.map((d) => [d.id, d]));
  const linhas = parsed.data.ids.flatMap((id, posicao) => {
    const d = porId.get(id);
    return d ? [{ id: d.id, routine_id: d.routine_id, name: d.name, position: posicao }] : [];
  });

  await supabase.from("routine_days").upsert(linhas, { onConflict: "id" });

  revalidar(atuais[0]?.routine_id);
}

/* ------------------------------------------------------------------ *
 * Prescrições
 * ------------------------------------------------------------------ */

export async function addExercise(formData: FormData) {
  await requireUser();
  const parsed = addExerciseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const supabase = await createClient();

  const [{ data: existentes }, { data: exercicio }] = await Promise.all([
    supabase.from("routine_exercises").select("position").eq("routine_day_id", parsed.data.routineDayId),
    supabase.from("exercises").select("default_rest_seconds").eq("id", parsed.data.exerciseId).maybeSingle(),
  ]);

  const posicoes = (existentes ?? []) as { position: number }[];
  const proxima = posicoes.length === 0 ? 0 : Math.max(...posicoes.map((e) => e.position)) + 1;
  const descanso = (exercicio as { default_rest_seconds: number } | null)?.default_rest_seconds ?? 120;

  await supabase.from("routine_exercises").insert({
    routine_day_id: parsed.data.routineDayId,
    exercise_id: parsed.data.exerciseId,
    position: proxima,
    target_sets: PRESCRICAO_PADRAO.targetSets,
    rep_min: PRESCRICAO_PADRAO.repMin,
    rep_max: PRESCRICAO_PADRAO.repMax,
    target_rir: PRESCRICAO_PADRAO.targetRir,
    rest_seconds: descanso,
  });

  revalidar((await routineIdOfDay(parsed.data.routineDayId)) ?? undefined);
}

export async function updatePrescription(
  _prev: RoutineActionState,
  formData: FormData,
): Promise<RoutineActionState> {
  await requireUser();
  const parsed = prescriptionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase
    .from("routine_exercises")
    .update({
      target_sets: parsed.data.targetSets,
      rep_min: parsed.data.repMin,
      rep_max: parsed.data.repMax,
      target_rir: parsed.data.targetRir,
      rest_seconds: parsed.data.restSeconds,
      load_step_kg_override: parsed.data.loadStepKgOverride,
      notes: parsed.data.notes || null,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: "Não foi possível salvar a prescrição. Tente de novo." };

  revalidar((await routineIdOfPrescription(parsed.data.id)) ?? undefined);
  return {};
}

export async function removeExercise(formData: FormData) {
  await requireUser();
  const parsed = routineIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const routineId = await routineIdOfPrescription(parsed.data.id);

  const supabase = await createClient();
  await supabase.from("routine_exercises").delete().eq("id", parsed.data.id);

  revalidar(routineId ?? undefined);
}

export async function reorderExercises(formData: FormData) {
  await requireUser();
  const parsed = reorderSchema.safeParse({ ids: formData.getAll("ids").map(String) });
  if (!parsed.success) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("routine_exercises")
    .select("id, routine_day_id, exercise_id, rep_min, rep_max")
    .in("id", parsed.data.ids);

  type Linha = {
    id: string;
    routine_day_id: string;
    exercise_id: string;
    rep_min: number;
    rep_max: number;
  };
  const atuais = (data ?? []) as Linha[];
  if (atuais.length !== parsed.data.ids.length) return;

  const porId = new Map(atuais.map((e) => [e.id, e]));
  const linhas = parsed.data.ids.flatMap((id, posicao) => {
    const e = porId.get(id);
    return e ? [{ ...e, position: posicao }] : [];
  });

  await supabase.from("routine_exercises").upsert(linhas, { onConflict: "id" });

  const dia = atuais[0]?.routine_day_id;
  revalidar(dia ? ((await routineIdOfDay(dia)) ?? undefined) : undefined);
}
