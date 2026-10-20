/**
 * Consistência: aderência e sequência de semanas.
 *
 * A semana começa na segunda-feira. As datas chegam já no fuso do usuário,
 * como "AAAA-MM-DD" — converter fuso é trabalho da borda, não do domínio.
 *
 * Sequência conta SEMANAS que atingiram a meta de frequência, não dias
 * seguidos: dias seguidos penalizariam o descanso, que é parte do programa.
 */

/** Janela da aderência, em semanas completas. */
export const ADHERENCE_WEEKS = 4;

function paraUtc(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  // Meio-dia: nenhum ajuste de horário de verão empurra para outro dia.
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function paraYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Segunda-feira da semana de uma data "AAAA-MM-DD". */
export function weekStartOf(ymd: string): string {
  const d = paraUtc(ymd);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return paraYmd(d);
}

/** A segunda-feira `n` semanas antes (n negativo vai para frente). */
export function shiftWeek(weekStart: string, n: number): string {
  const d = paraUtc(weekStart);
  d.setUTCDate(d.getUTCDate() - 7 * n);
  return paraYmd(d);
}

/** Quantos treinos concluídos em cada semana, pela segunda-feira. */
export function countByWeek(dates: readonly string[]): Map<string, number> {
  const contagem = new Map<string, number>();
  for (const d of dates) {
    const semana = weekStartOf(d);
    contagem.set(semana, (contagem.get(semana) ?? 0) + 1);
  }
  return contagem;
}

/**
 * Semanas seguidas na meta, terminando na semana atual.
 *
 * A semana atual só entra quando já bateu a meta. Enquanto não bate, ela
 * não quebra a sequência: a semana ainda não acabou. Quem quebra é uma
 * semana passada que terminou abaixo da meta.
 */
export function weekStreak(dates: readonly string[], weeklyTarget: number, today: string): number {
  if (!(weeklyTarget >= 1)) return 0;
  const contagem = countByWeek(dates);
  const atual = weekStartOf(today);

  let sequencia = (contagem.get(atual) ?? 0) >= weeklyTarget ? 1 : 0;
  for (let n = 1; ; n++) {
    if ((contagem.get(shiftWeek(atual, n)) ?? 0) < weeklyTarget) break;
    sequencia++;
  }
  return sequencia;
}

/**
 * Aderência nas últimas semanas completas: treinos feitos ÷ planejados,
 * de 0 a 1. A semana atual fica fora, porque ainda não acabou.
 *
 * Cada semana conta no máximo a meta: treinar sete vezes numa semana não
 * compensa a semana em que não treinou, porque não é isso que aderência
 * mede.
 */
export function adherence(
  dates: readonly string[],
  weeklyTarget: number,
  today: string,
  weeks: number = ADHERENCE_WEEKS,
): number {
  if (!(weeklyTarget >= 1) || !(weeks >= 1)) return 0;
  const contagem = countByWeek(dates);
  const atual = weekStartOf(today);

  let feitos = 0;
  for (let n = 1; n <= weeks; n++) feitos += Math.min(weeklyTarget, contagem.get(shiftWeek(atual, n)) ?? 0);
  return feitos / (weeklyTarget * weeks);
}
