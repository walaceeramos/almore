/**
 * Incremento de carga: de quanto em quanto a carga sobe num exercício.
 *
 * Função pura, sem banco nem rede, porque a progressão dupla da Fase 5
 * decide a partir dela: quando todas as séries de trabalho chegam ao topo
 * da faixa dentro do RIR alvo, a sugestão é subir exatamente um incremento.
 *
 * O valor é propriedade física do equipamento — halter sobe de 2 em 2 kg,
 * máquina de 2,5 a 5 — e por isso mora em `exercises.load_step_kg`. Mas a
 * mesma máquina tem anilhas diferentes em academias diferentes, e o mesmo
 * exercício pode aparecer em duas rotinas com progressão distinta. Daí o
 * override por prescrição.
 */

/** Padrão quando nem a prescrição nem o exercício trazem valor utilizável. */
export const DEFAULT_LOAD_STEP_KG = 2.5;

/**
 * `numeric` do Postgres chega como string ("2.50"). Converte para número,
 * recusando o que não serve como incremento: nulo, vazio, não numérico,
 * zero ou negativo.
 */
function toStep(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Override da rotina quando houver; senão o do exercício; senão o padrão.
 *
 * @param override `routine_exercises.load_step_kg_override`
 * @param exerciseStep `exercises.load_step_kg`
 */
export function resolveLoadStep(
  override: string | number | null | undefined,
  exerciseStep: string | number | null | undefined,
): number {
  return toStep(override) ?? toStep(exerciseStep) ?? DEFAULT_LOAD_STEP_KG;
}
