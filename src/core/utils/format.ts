/**
 * Formatação compartilhada entre features. Mora em `core` porque o
 * catálogo de exercícios e os ajustes do perfil precisam do mesmo
 * formato, e uma feature não importa de outra.
 */

/**
 * Peso para leitura: tira zeros à direita e usa vírgula decimal.
 * `numeric` do Postgres chega como string formatada — "80.00" vira "80",
 * "2.50" vira "2,5".
 */
export function kg(value: string | number): string {
  return String(value).replace(/\.?0+$/, "").replace(".", ",");
}
