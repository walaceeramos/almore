/**
 * Formatação compartilhada entre features. Mora em `core` porque o
 * catálogo de exercícios e os ajustes do perfil precisam do mesmo
 * formato, e uma feature não importa de outra.
 */

/**
 * Peso para leitura: tira zeros à direita da parte decimal e usa vírgula.
 * "80.00" e 80 viram "80"; "2.50" e 2.5 viram "2,5".
 *
 * Os zeros só são cortados depois do ponto. A versão anterior usava
 * `/\.?0+$/`, que mordia o número inteiro: `kg(80)` devolvia "8" e
 * `kg(100)` devolvia "1". Não aparecia na tela porque quem chama passa
 * `toFixed(2)`, mas a primeira chamada que esquecesse o `toFixed` mostraria
 * peso errado sem avisar.
 */
export function kg(value: string | number): string {
  const texto = String(value);
  const limpo = texto.includes(".") ? texto.replace(/0+$/, "").replace(/\.$/, "") : texto;
  return limpo.replace(".", ",");
}
