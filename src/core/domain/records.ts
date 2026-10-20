/**
 * Recordes pessoais e 1RM estimado.
 *
 * Quatro tipos, todos só sobre séries de trabalho com carga externa:
 *
 * | Tipo           | Valor                                         |
 * | -------------- | --------------------------------------------- |
 * | carga_maxima   | maior peso com pelo menos uma repetição       |
 * | melhor_serie   | maior 1RM estimado numa série                 |
 * | volume_serie   | maior peso × repetições numa série            |
 * | volume_sessao  | maior tonelagem no exercício numa sessão      |
 *
 * Aquecimento não conta. Série sem carga (peso corporal puro) também não:
 * o recorde seria do corpo, não da carga, e mudaria com a balança. Em
 * exercício de peso corporal com carga adicional, conta a carga adicional.
 *
 * Empate não troca o recorde: quem chegou primeiro fica com ele.
 */

import { addKg, type DomainSet } from "./types";

/** Acima disso a fórmula de Epley perde precisão. */
export const EPLEY_RELIABLE_MAX_REPS = 12;

export type OneRepMax = {
  valueKg: number;
  /** Verdadeiro acima de 12 repetições: mostre como estimativa fraca. */
  weak: boolean;
};

/**
 * Epley: carga × (1 + repetições / 30). Uma repetição é a própria carga.
 * Nulo quando não há o que estimar: sem carga ou sem repetição válida.
 */
export function estimateOneRepMax(weightKg: number | null, reps: number): OneRepMax | null {
  if (weightKg === null || !(weightKg > 0) || !(reps >= 1)) return null;
  const valor = reps === 1 ? weightKg : weightKg * (1 + reps / 30);
  return { valueKg: Math.round(valor * 100) / 100, weak: reps > EPLEY_RELIABLE_MAX_REPS };
}

export type RecordKind = "carga_maxima" | "melhor_serie" | "volume_serie" | "volume_sessao";

export const SET_RECORD_KINDS = ["carga_maxima", "melhor_serie", "volume_serie"] as const;
export type SetRecordKind = (typeof SET_RECORD_KINDS)[number];

/** Série com a origem, para o recorde apontar de onde veio. */
export type RecordSet = DomainSet & {
  id: string;
  sessionId: string;
  /** ISO 8601. Ordena quem chegou primeiro. */
  achievedAt: string;
};

export type PersonalRecord = {
  kind: RecordKind;
  value: number;
  /** Nulo em volume_sessao, que é da sessão e não de uma série. */
  setId: string | null;
  sessionId: string;
  achievedAt: string;
  /** Da série de origem; em volume_sessao, da série mais pesada da sessão. */
  weightKg: number;
  reps: number;
};

/** O que a série vale em cada tipo de recorde de série. Nulo se não conta. */
export function setRecordValues(s: DomainSet): Record<SetRecordKind, number> | null {
  if (s.kind !== "trabalho" || s.weightKg === null || !(s.weightKg > 0) || !(s.reps >= 1)) return null;
  const rm = estimateOneRepMax(s.weightKg, s.reps);
  if (!rm) return null;
  return {
    carga_maxima: s.weightKg,
    melhor_serie: rm.valueKg,
    volume_serie: (Math.round(s.weightKg * 100) * s.reps) / 100,
  };
}

/**
 * Recordes atuais de um exercício, recalculados do zero a partir de todas
 * as séries. Recalcular em vez de comparar com o anterior é o que deixa a
 * edição retroativa da Fase 6 correta: corrigir uma série antiga muda o
 * resultado sem nenhum caso especial.
 */
export function computeRecords(sets: readonly RecordSet[]): Partial<Record<RecordKind, PersonalRecord>> {
  const ordenadas = [...sets].sort((a, b) => a.achievedAt.localeCompare(b.achievedAt) || a.id.localeCompare(b.id));
  const melhores: Partial<Record<RecordKind, PersonalRecord>> = {};

  const porSessao = new Map<string, { total: number; inicio: string; topo: RecordSet }>();

  for (const s of ordenadas) {
    const valores = setRecordValues(s);
    if (!valores || s.weightKg === null) continue;

    for (const kind of SET_RECORD_KINDS) {
      const atual = melhores[kind];
      if (!atual || valores[kind] > atual.value) {
        melhores[kind] = {
          kind,
          value: valores[kind],
          setId: s.id,
          sessionId: s.sessionId,
          achievedAt: s.achievedAt,
          weightKg: s.weightKg,
          reps: s.reps,
        };
      }
    }

    const sessao = porSessao.get(s.sessionId);
    if (!sessao) {
      porSessao.set(s.sessionId, { total: valores.volume_serie, inicio: s.achievedAt, topo: s });
    } else {
      sessao.total = addKg(sessao.total, valores.volume_serie);
      if ((s.weightKg ?? 0) > (sessao.topo.weightKg ?? 0)) sessao.topo = s;
    }
  }

  // Map preserva a ordem de inserção, que já é cronológica.
  for (const [sessionId, sessao] of porSessao) {
    const atual = melhores.volume_sessao;
    if (!atual || sessao.total > atual.value) {
      melhores.volume_sessao = {
        kind: "volume_sessao",
        value: sessao.total,
        setId: null,
        sessionId,
        achievedAt: sessao.inicio,
        weightKg: sessao.topo.weightKg ?? 0,
        reps: sessao.topo.reps,
      };
    }
  }

  return melhores;
}

/**
 * Durante o treino: quais recordes de série cada série desta sessão bateu,
 * na ordem em que foram feitas. Cada série compete com os recordes
 * anteriores e com as séries que vieram antes dela na mesma sessão — a
 * segunda série que supera a primeira também é recorde.
 */
export function sessionRecordMarks(
  sets: readonly DomainSet[],
  previousBest: Partial<Record<SetRecordKind, number>>,
): SetRecordKind[][] {
  const melhor: Partial<Record<SetRecordKind, number>> = { ...previousBest };
  return sets.map((s) => {
    const valores = setRecordValues(s);
    if (!valores) return [];
    const batidos: SetRecordKind[] = [];
    for (const kind of SET_RECORD_KINDS) {
      const antes = melhor[kind];
      if (antes === undefined || valores[kind] > antes) {
        // Primeira vez no exercício não é recorde: não havia o que bater.
        if (antes !== undefined) batidos.push(kind);
        melhor[kind] = valores[kind];
      }
    }
    return batidos;
  });
}
