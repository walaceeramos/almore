/**
 * Volume. Duas métricas, com papéis diferentes:
 *
 * - Séries de trabalho por grupo muscular por semana é a principal, porque
 *   é a que a literatura usa.
 * - Tonelagem (peso × repetições) é reportada em paralelo, com ressalva:
 *   premia exercício de carga alta e não compara grupos diferentes.
 */

/**
 * Quanto um exercício conta para um músculo, vindo de
 * `exercise_muscles.contribution`: primário 1, secundário 0,5. É uma
 * convenção, não uma verdade fisiológica — a interface precisa dizer isso.
 */
export type MuscleContribution = { muscleId: string; contribution: number };

/**
 * Séries de trabalho por músculo. Cada série de trabalho soma a
 * contribuição do exercício a cada músculo dele; aquecimento não conta.
 * Exercício sem músculo cadastrado não soma em lugar nenhum.
 *
 * Em centésimos, como a tonelagem: 0,5 + 0,5 + ... em float acumula erro.
 */
export function setsPerMuscle(
  entries: readonly { kind: "aquecimento" | "trabalho"; muscles: readonly MuscleContribution[] }[],
): Record<string, number> {
  const centesimos: Record<string, number> = {};
  for (const e of entries) {
    if (e.kind !== "trabalho") continue;
    for (const m of e.muscles) {
      if (!(m.contribution > 0)) continue;
      centesimos[m.muscleId] = (centesimos[m.muscleId] ?? 0) + Math.round(m.contribution * 100);
    }
  }
  return Object.fromEntries(Object.entries(centesimos).map(([id, c]) => [id, c / 100]));
}

/**
 * Tonelagem: soma de peso × repetições nas séries de trabalho.
 *
 * Aquecimento não conta, pela mesma regra que vale para o volume. Série sem
 * carga externa (peso corporal) também não: somar o peso do corpo exigiria
 * saber quanto dele cada exercício desloca, e um número inventado aqui
 * contaminaria toda comparação futura.
 */

export type TonnageSet = {
  kind: "aquecimento" | "trabalho";
  /** `numeric` chega como string do Postgres; nulo = só o peso do corpo. */
  weightKg: string | number | null;
  reps: number;
};

/**
 * Em kg. A conta é feita em centésimos inteiros: `numeric(6,2)` tem duas
 * casas, e somar em ponto flutuante acumularia o erro que a coluna existe
 * para evitar.
 */
export function tonnageKg(sets: readonly TonnageSet[]): number {
  let centesimos = 0;
  for (const s of sets) {
    if (s.kind !== "trabalho" || s.weightKg === null) continue;
    const peso = Number(s.weightKg);
    if (!Number.isFinite(peso) || peso <= 0 || s.reps <= 0) continue;
    centesimos += Math.round(peso * 100) * s.reps;
  }
  return centesimos / 100;
}
