import { allExercises, findExercise, muscleName, type AnyExercise } from "@/core/data/exercises";
import type { ExerciseFilters } from "./schemas";

export { listMuscles } from "@/core/data/exercises";

export type ExerciseListItem = {
  id: string;
  name: string;
  /** Verdadeiro para exercício criado pelo usuário. */
  isCustom: boolean;
  pattern: string;
  equipment: string;
  isUnilateral: boolean;
  defaultRestSeconds: number;
  loadStepKg: number;
  cue: string | null;
  archivedAt: string | null;
  muscles: { id: string; name: string; role: string }[];
};

function toItem(e: AnyExercise): ExerciseListItem {
  return {
    id: e.id,
    name: e.name,
    isCustom: e.isCustom,
    pattern: e.pattern,
    equipment: e.equipment,
    isUnilateral: e.isUnilateral,
    defaultRestSeconds: e.defaultRestSeconds,
    loadStepKg: e.loadStepKg,
    cue: e.cue,
    archivedAt: e.archivedAt,
    muscles: e.muscles
      .map((m) => ({ id: m.muscleId, name: muscleName(m.muscleId), role: m.role }))
      .sort((a, b) => (a.role === b.role ? 0 : a.role === "primario" ? -1 : 1)),
  };
}

/** Busca sem acento e sem caixa: "triceps" acha "Tríceps". */
function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Catálogo mais os próprios, sem os arquivados. Filtrar em memória é o
 * caminho certo aqui: são algumas centenas de itens já no aparelho, e a
 * resposta vem a cada tecla sem ida à rede.
 */
export async function listExercises(filters: ExerciseFilters): Promise<ExerciseListItem[]> {
  const termo = filters.busca ? normalizar(filters.busca.trim()) : "";

  return (await allExercises())
    .filter((e) => e.archivedAt === null)
    .filter((e) => !termo || normalizar(e.name).includes(termo))
    .filter((e) => !filters.musculo || e.muscles.some((m) => m.muscleId === filters.musculo))
    .filter((e) => !filters.equipamento || e.equipment === filters.equipamento)
    .filter((e) => !filters.padrao || e.pattern === filters.padrao)
    .filter((e) => filters.origem !== "catalogo" || !e.isCustom)
    .filter((e) => filters.origem !== "meus" || e.isCustom)
    .map(toItem)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Inclui arquivados: o histórico aponta para eles. */
export async function getExercise(id: string): Promise<ExerciseListItem | null> {
  const e = await findExercise(id);
  return e ? toItem(e) : null;
}
