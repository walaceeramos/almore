import { createClient } from "@/core/auth/server";
import type { ExerciseFilters } from "./schemas";

export type ExerciseListItem = {
  id: string;
  name: string;
  slug: string | null;
  ownerId: string | null;
  pattern: string;
  equipment: string;
  isUnilateral: boolean;
  defaultRestSeconds: number;
  loadStepKg: string;
  cue: string | null;
  muscles: { id: string; name: string; role: string }[];
};

type Row = {
  id: string;
  name: string;
  slug: string | null;
  owner_id: string | null;
  pattern: string;
  equipment: string;
  is_unilateral: boolean;
  default_rest_seconds: number;
  load_step_kg: string;
  cue: string | null;
  exercise_muscles: { role: string; muscles: { id: string; name: string } | null }[] | null;
};

const SELECT = `
  id, name, slug, owner_id, pattern, equipment, is_unilateral,
  default_rest_seconds, load_step_kg, cue,
  exercise_muscles ( role, muscles ( id, name ) )
`;

function toItem(row: Row): ExerciseListItem {
  const muscles = (row.exercise_muscles ?? [])
    .filter((m) => m.muscles)
    .map((m) => ({ id: m.muscles!.id, name: m.muscles!.name, role: m.role }))
    .sort((a, b) => (a.role === b.role ? 0 : a.role === "primario" ? -1 : 1));

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    ownerId: row.owner_id,
    pattern: row.pattern,
    equipment: row.equipment,
    isUnilateral: row.is_unilateral,
    defaultRestSeconds: row.default_rest_seconds,
    loadStepKg: row.load_step_kg,
    cue: row.cue,
    muscles,
  };
}

export async function listExercises(filters: ExerciseFilters): Promise<ExerciseListItem[]> {
  const supabase = await createClient();

  // O RLS já limita a catálogo global + próprios. Aqui é só refino.
  let query = supabase.from("exercises").select(SELECT).is("archived_at", null);

  if (filters.busca) {
    // Escapa o coringa do PostgREST para a busca não virar padrão arbitrário.
    const termo = filters.busca.replace(/[%_,]/g, " ").trim();
    if (termo) query = query.ilike("name", `%${termo}%`);
  }
  if (filters.equipamento) query = query.eq("equipment", filters.equipamento);
  if (filters.padrao) query = query.eq("pattern", filters.padrao);
  if (filters.origem === "catalogo") query = query.is("owner_id", null);
  if (filters.origem === "meus") query = query.not("owner_id", "is", null);

  const { data, error } = await query.order("name").limit(300);
  if (error) throw new Error(`Falha ao listar exercícios: ${error.message}`);

  const itens = (data as unknown as Row[]).map(toItem);

  // Filtro por músculo é feito aqui: a junção aninhada do PostgREST não
  // permite filtrar sem descartar os demais vínculos da mesma linha.
  if (!filters.musculo) return itens;
  return itens.filter((e) => e.muscles.some((m) => m.id === filters.musculo));
}

export async function getExercise(id: string): Promise<ExerciseListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("exercises").select(SELECT).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return toItem(data as unknown as Row);
}

export async function listMuscles() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("muscles")
    .select("id, name, region, sort_order")
    .order("sort_order");
  if (error) throw new Error(`Falha ao carregar grupos musculares: ${error.message}`);
  return (data ?? []) as { id: string; name: string; region: string; sort_order: number }[];
}
