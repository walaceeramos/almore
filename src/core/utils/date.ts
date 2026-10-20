/**
 * Datas no fuso do usuário, sem biblioteca. O servidor roda em UTC e o
 * usuário treina em America/Sao_Paulo: às 22h de domingo, em UTC, já é
 * segunda — e a contagem da semana erraria sem esta conversão.
 */

/**
 * "2026-10-19" no fuso informado. O formato en-CA já sai como AAAA-MM-DD,
 * que é o que `core/domain/consistency` recebe; comparar strings nesse
 * formato é comparar datas.
 */
export function localDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** "18:30" no fuso informado. */
export function localTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    date,
  );
}

/** Quanto o fuso está à frente do UTC naquele instante, em ms. */
function offsetMs(instante: number, timeZone: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instante));
  const v = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  const comoUtc = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second"));
  return comoUtc - Math.floor(instante / 1000) * 1000;
}

/**
 * O instante em que o relógio do fuso marca aquela data e hora. É o
 * inverso de `localDate` + `localTime`: o usuário digita "20/10 às 18:30"
 * no horário dele, e o banco guarda UTC.
 *
 * Duas passadas: a primeira estimativa pode cair do outro lado de uma
 * troca de horário de verão, e a segunda corrige.
 */
export function zonedToUtc(ymd: string, hm: string, timeZone: string): Date {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  const [h, min] = hm.split(":").map(Number) as [number, number];
  const relogio = Date.UTC(y, m - 1, d, h, min);
  let utc = relogio - offsetMs(relogio, timeZone);
  utc = relogio - offsetMs(utc, timeZone);
  return new Date(utc);
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
