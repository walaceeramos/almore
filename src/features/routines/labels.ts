/** 0 = domingo, como em routine_days.suggested_weekday. */
export const WEEKDAYS = [
  { value: 0, label: "Domingo", short: "Dom" },
  { value: 1, label: "Segunda", short: "Seg" },
  { value: 2, label: "Terça", short: "Ter" },
  { value: 3, label: "Quarta", short: "Qua" },
  { value: 4, label: "Quinta", short: "Qui" },
  { value: 5, label: "Sexta", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
] as const;

export function weekdayLabel(value: number | null): string | null {
  return WEEKDAYS.find((d) => d.value === value)?.label ?? null;
}

/** "8 a 12" quando há faixa, "10" quando mínimo e máximo coincidem. */
export function repRangeLabel(min: number, max: number): string {
  return min === max ? String(min) : `${min} a ${max}`;
}

/** "4 × 8 a 12" — a leitura que o usuário espera ver no cartão do dia. */
export function prescriptionLabel(sets: number, repMin: number, repMax: number): string {
  return `${sets} × ${repRangeLabel(repMin, repMax)}`;
}

export function rirLabel(value: number | null): string | null {
  if (value === null) return null;
  return value === 0 ? "RIR 0, até a falha" : `RIR ${value}`;
}

/** Rótulos sugeridos ao criar um programa: Dia A, Dia B... */
export function defaultDayName(index: number): string {
  const letra = String.fromCharCode(65 + (index % 26));
  return `Dia ${letra}`;
}
