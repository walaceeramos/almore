/**
 * Tonelagem: soma de peso × repetições nas séries de trabalho.
 *
 * Fase 4 entrega só a tonelagem simples do resumo da sessão. Séries por
 * grupo muscular, que é a métrica principal de volume, chegam na Fase 5.
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
