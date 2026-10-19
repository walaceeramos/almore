/**
 * Próximo dia da sequência do programa.
 *
 * O programa é sequência, não calendário (ver comentário de routine_days na
 * 0005): quem treina em dias variáveis só percorre a ordem. Depois do último
 * dia volta ao primeiro.
 *
 * @param orderedDayIds dias do programa, já na ordem
 * @param lastTrainedDayId dia da última sessão concluída; nulo se nunca treinou
 *   ou se aquele dia foi removido do programa
 */
export function nextDayId(orderedDayIds: readonly string[], lastTrainedDayId: string | null): string | null {
  if (orderedDayIds.length === 0) return null;
  const i = lastTrainedDayId === null ? -1 : orderedDayIds.indexOf(lastTrainedDayId);
  // Dia removido cai em -1 e recomeça do primeiro, que é o palpite mais seguro.
  return orderedDayIds[(i + 1) % orderedDayIds.length] ?? null;
}
