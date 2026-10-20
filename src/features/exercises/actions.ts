import { db } from "@/core/data/db";
import { allExercises } from "@/core/data/exercises";
import { nowIso, toKg, type Equipment, type Pattern } from "@/core/data/types";
import { newId } from "@/core/utils/uuid";
import { customExerciseSchema, type ExerciseActionState } from "./schemas";

export async function createCustomExercise(
  _prev: ExerciseActionState,
  formData: FormData,
): Promise<ExerciseActionState> {
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

  // O banco garantia nome único entre os próprios; agora é aqui.
  const nome = input.name.toLocaleLowerCase("pt-BR");
  const repetido = (await allExercises()).some(
    (e) => e.isCustom && e.archivedAt === null && e.name.toLocaleLowerCase("pt-BR") === nome,
  );
  if (repetido) return { fieldErrors: { name: ["Você já tem um exercício com esse nome."] } };

  const id = newId();
  try {
    // Exercício e vínculo muscular num registro só: o rollback manual da
    // versão com banco (apagar o órfão) deixa de existir.
    await db.customExercises.add({
      id,
      name: input.name,
      pattern: input.pattern as Pattern,
      equipment: input.equipment as Equipment,
      isUnilateral: input.isUnilateral ?? false,
      defaultRestSeconds: input.defaultRestSeconds,
      loadStepKg: toKg(input.loadStepKg),
      cue: input.cue || null,
      muscles: [
        { muscleId: input.primaryMuscle, role: "primario" },
        ...(input.secondaryMuscles ?? [])
          .filter((m) => m && m !== input.primaryMuscle)
          .map((m) => ({ muscleId: m, role: "secundario" as const })),
      ],
      archivedAt: null,
      createdAt: nowIso(),
    });
  } catch {
    return { error: "Não foi possível salvar o exercício. Tente de novo." };
  }

  return { redirectTo: `/exercicios/${id}` };
}

/** Exclusão lógica: o histórico aponta para o exercício. */
export async function archiveCustomExercise(id: string): Promise<void> {
  await db.customExercises.update(id, { archivedAt: nowIso() });
}
