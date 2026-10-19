/**
 * Datas no fuso do usuário, sem biblioteca. O servidor roda em UTC e o
 * usuário treina em America/Sao_Paulo: às 22h de domingo, em UTC, já é
 * segunda — e a contagem da semana erraria sem esta conversão.
 */

/** "2026-10-19" no fuso informado. O formato en-CA já sai como AAAA-MM-DD. */
export function localDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Segunda-feira da semana de `date`, no fuso informado, como AAAA-MM-DD.
 * Comparar strings nesse formato é comparar datas.
 */
export function localWeekStart(date: Date, timeZone: string): string {
  const [y, m, d] = localDate(date, timeZone).split("-").map(Number) as [number, number, number];
  // Meio-dia em UTC para o dia da semana não escorregar com horário de verão.
  const meioDia = new Date(Date.UTC(y, m - 1, d, 12));
  const desdeSegunda = (meioDia.getUTCDay() + 6) % 7;
  meioDia.setUTCDate(meioDia.getUTCDate() - desdeSegunda);
  return meioDia.toISOString().slice(0, 10);
}

/** "1 h 05 min", "42 min", "50 s". */
export function durationLabel(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} h ${String(min).padStart(2, "0")} min`;
  if (min > 0) return `${min} min`;
  return `${s} s`;
}

/** "1:05:09" ou "5:09", para relógio que corre na tela. */
export function clockLabel(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  const seg = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(min).padStart(2, "0")}:${seg}` : `${min}:${seg}`;
}
