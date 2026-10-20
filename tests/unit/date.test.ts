import { describe, expect, it } from "vitest";
import { localDate, localTime, zonedToUtc } from "@/core/utils/date";

// Não é domínio, mas a edição de horário do histórico depende disto, e um
// erro aqui muda a semana em que o treino conta.

describe("zonedToUtc", () => {
  it("São Paulo é UTC−3", () => {
    expect(zonedToUtc("2026-10-20", "18:30", "America/Sao_Paulo").toISOString()).toBe("2026-10-20T21:30:00.000Z");
  });

  it("22h em São Paulo já é o dia seguinte em UTC", () => {
    expect(zonedToUtc("2026-10-25", "22:00", "America/Sao_Paulo").toISOString()).toBe("2026-10-26T01:00:00.000Z");
  });

  it("respeita horário de verão de outros fusos", () => {
    // Nova York: UTC−4 em julho, UTC−5 em janeiro.
    expect(zonedToUtc("2026-07-01", "12:00", "America/New_York").toISOString()).toBe("2026-07-01T16:00:00.000Z");
    expect(zonedToUtc("2026-01-15", "12:00", "America/New_York").toISOString()).toBe("2026-01-15T17:00:00.000Z");
  });

  it("ida e volta devolve o que o usuário digitou", () => {
    const fuso = "America/Sao_Paulo";
    const instante = zonedToUtc("2026-03-01", "06:05", fuso);
    expect(localDate(instante, fuso)).toBe("2026-03-01");
    expect(localTime(instante, fuso)).toBe("06:05");
  });
});
