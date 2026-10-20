/**
 * Formas mínimas que as regras de domínio consomem.
 *
 * Declaradas aqui, e não importadas de `core/db/schema` ou de `features`,
 * porque o domínio é puro: recebe números já convertidos e não sabe de
 * onde vieram. Quem lê do banco converte `numeric` (string) para número na
 * borda, como em qualquer consulta.
 */

export type SetKind = "aquecimento" | "trabalho";

/** Uma série feita. `weightKg` nulo = só o peso do corpo. */
export type DomainSet = {
  kind: SetKind;
  weightKg: number | null;
  reps: number;
  rir: number | null;
};

/** Faixa prescrita. Nulos juntos quando o exercício não tinha prescrição. */
export type RepRange = {
  targetSets: number | null;
  repMin: number | null;
  repMax: number | null;
  targetRir: number | null;
};

/** Uma sessão com aquele exercício: as séries e a prescrição que valia nela. */
export type ExerciseSession = RepRange & { sets: DomainSet[] };

export function workSets<T extends { kind: SetKind }>(sets: readonly T[]): T[] {
  return sets.filter((s) => s.kind === "trabalho");
}

/** Soma em centésimos e volta: `numeric(6,2)` tem duas casas, float acumula erro. */
export function addKg(a: number, b: number): number {
  return (Math.round(a * 100) + Math.round(b * 100)) / 100;
}
