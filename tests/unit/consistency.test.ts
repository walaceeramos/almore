import { describe, expect, it } from "vitest";
import { adherence, shiftWeek, weekStartOf, weekStreak } from "@/core/domain/consistency";
import { nextDayId } from "@/core/domain/next-day";

// 2026-10-19 é segunda-feira.
const HOJE = "2026-10-21"; // quarta

describe("weekStartOf", () => {
  it("leva qualquer dia à segunda da mesma semana", () => {
    expect(weekStartOf("2026-10-19")).toBe("2026-10-19");
    expect(weekStartOf("2026-10-21")).toBe("2026-10-19");
    // Domingo pertence à semana que começou na segunda anterior.
    expect(weekStartOf("2026-10-25")).toBe("2026-10-19");
  });

  it("atravessa virada de mês e de ano", () => {
    expect(weekStartOf("2026-11-01")).toBe("2026-10-26");
    expect(weekStartOf("2027-01-01")).toBe("2026-12-28");
  });

  it("shiftWeek anda de sete em sete dias", () => {
    expect(shiftWeek("2026-10-19", 1)).toBe("2026-10-12");
    expect(shiftWeek("2026-10-19", -1)).toBe("2026-10-26");
  });
});

describe("weekStreak", () => {
  it("sem treino nenhum é zero", () => {
    expect(weekStreak([], 3, HOJE)).toBe(0);
  });

  it("semana atual abaixo da meta não quebra a sequência das anteriores", () => {
    const datas = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-05", "2026-10-06", "2026-10-07"];
    expect(weekStreak(datas, 3, HOJE)).toBe(2);
  });

  it("semana atual entra quando já bateu a meta", () => {
    const datas = ["2026-10-19", "2026-10-20", "2026-10-12", "2026-10-13"];
    expect(weekStreak(datas, 2, HOJE)).toBe(2);
  });

  it("semana passada abaixo da meta quebra", () => {
    const datas = ["2026-10-12", "2026-10-05", "2026-10-06"];
    expect(weekStreak(datas, 2, HOJE)).toBe(0);
  });

  it("treinar dias seguidos não conta mais que a semana", () => {
    const datas = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"];
    expect(weekStreak(datas, 3, HOJE)).toBe(1);
  });
});

describe("adherence", () => {
  it("feitos sobre planejados nas quatro semanas completas", () => {
    // Meta 2: duas semanas cheias, uma com um treino, uma vazia = 5/8.
    const datas = ["2026-10-12", "2026-10-13", "2026-10-05", "2026-10-06", "2026-09-28"];
    expect(adherence(datas, 2, HOJE)).toBe(5 / 8);
  });

  it("semana acima da meta não compensa outra abaixo", () => {
    const datas = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"];
    expect(adherence(datas, 2, HOJE)).toBe(2 / 8);
  });

  it("a semana atual fica fora", () => {
    expect(adherence(["2026-10-19", "2026-10-20"], 2, HOJE)).toBe(0);
  });
});

describe("nextDayId", () => {
  const dias = ["a", "b", "c"];

  it("sem histórico começa do primeiro", () => {
    expect(nextDayId(dias, null)).toBe("a");
  });

  it("segue a sequência e volta ao início", () => {
    expect(nextDayId(dias, "a")).toBe("b");
    expect(nextDayId(dias, "c")).toBe("a");
  });

  it("dia removido do programa recomeça do primeiro", () => {
    expect(nextDayId(dias, "removido")).toBe("a");
  });

  it("programa sem dias não tem próximo", () => {
    expect(nextDayId([], null)).toBeNull();
  });
});
