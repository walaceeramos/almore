"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/core/auth/server";
import { requireUser } from "@/core/auth/session";
import { customExerciseSchema, type ExerciseActionState } from "./schemas";

export async function createCustomExercise(
  _prev: ExerciseActionState,
  formData: FormData,
): Promise<ExerciseActionState> {
  const user = await requireUser();

  const parsed = customExerciseSchema.safeParse({
    name: formData.get("name"),
    pattern: formData.get("pattern"),
    equipment: formData.get("equipment"),
    primaryMuscle: formData.get("primaryMuscle"),
    secondaryMuscles: formData.getAll("secondaryMuscles").map(String),
    defaultRestSeconds: formData.get("defaultRestSeconds"),
    loadStepKg: formData.get("loadStepKg"),
    isUnilateral: formData.get("isUnilateral") === "on",
    cue: formData.get("cue") || undefined,
  });

  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const input = parsed.data;

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("exercises")
    .insert({
      owner_id: user.id,
      slug: null,
      name: input.name,
      pattern: input.pattern,
      equipment: input.equipment,
      is_unilateral: input.isUnilateral ?? false,
      default_rest_seconds: input.defaultRestSeconds,
      load_step_kg: input.loadStepKg,
      cue: input.cue || null,
    })
    .select("id")
    .single();

  if (error || !created) {
    if (error?.code === "23505") {
      return { fieldErrors: { name: ["Você já tem um exercício com esse nome."] } };
    }
    return { error: "Não foi possível salvar o exercício. Tente de novo." };
  }

  const vinculos = [
    { exercise_id: created.id, muscle_id: input.primaryMuscle, role: "primario", contribution: 1 },
    ...(input.secondaryMuscles ?? [])
      .filter((m) => m && m !== input.primaryMuscle)
      .map((m) => ({ exercise_id: created.id, muscle_id: m, role: "secundario", contribution: 0.5 })),
  ];

  const { error: erroVinculo } = await supabase.from("exercise_muscles").insert(vinculos);
  if (erroVinculo) {
    // Sem vínculo muscular o exercício não conta volume: melhor desfazer.
    await supabase.from("exercises").delete().eq("id", created.id);
    return { error: "Não foi possível vincular os grupos musculares. Tente de novo." };
  }

  revalidatePath("/exercicios");
  redirect(`/exercicios/${created.id}`);
}

/** Exclusão lógica: o histórico futuro aponta para o exercício. */
export async function archiveCustomExercise(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("exercises")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id);

  revalidatePath("/exercicios");
  redirect("/exercicios");
}
