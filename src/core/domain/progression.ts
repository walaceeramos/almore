/**
 * Progressão dupla: primeiro as repetições sobem dentro da faixa, depois a
 * carga sobe e as repetições voltam ao fundo.
 *
 * - Todas as séries de trabalho chegaram ao topo da faixa dentro do RIR
 *   alvo → subir um incremento e voltar ao fundo da faixa.
 * - Alguma série abaixo do fundo da faixa em DUAS sessões consecutivas →
 *   reduzir um incremento. Uma sessão ruim isolada não é tendência.
 * - Qualquer outro caso → manter a carga e buscar uma repetição a mais.
 *
 * Detalhes que a regra do planejamento não fixava, decididos com o usuário:
 *
 * - Série sem RIR anotado conta como dentro do RIR alvo. Sem isso, quem
 *   não anota RIR nunca receberia sugestão de subir.
 * - "Dentro do RIR alvo" é `rir >= alvo`: chegar ao topo com mais reserva
 *   que o alvo é ainda mais motivo para subir; com menos, foi perto demais
 *   da falha e a carga fica.
 * - Exercício de peso corporal sem carga adicional não tem o que subir:
 *   a sugestão é só de repetições.
 * - Cada sessão é julgada pela prescrição que valia nela (o snapshot). A
 *   sugestão de repetições usa a prescrição de hoje.
 * - A carga de referência é a maior entre as séries de trabalho da última
 *   sessão: quem fez pirâmide progride a partir da série mais pesada.
 */

import { addKg, workSets, type DomainSet, type ExerciseSession, type RepRange } from "./types";

export type ProgressionAction = "subir" | "manter" | "reduzir" | "primeira_vez";

export type ProgressionVerdict = {
  action: ProgressionAction;
  /** Carga sugerida; nulo = só o peso do corpo, ou primeira vez sem referência. */
  weightKg: number | null;
  reps: number;
  /** Uma frase curta, para o usuário entender o porquê. */
  reason: string;
};

/** Repetições quando não há faixa nem histórico. */
const REPS_PADRAO = 10;

function maiorCarga(sets: readonly DomainSet[]): number | null {
  let maior: number | null = null;
  for (const s of sets) if (s.weightKg !== null && (maior === null || s.weightKg > maior)) maior = s.weightKg;
  return maior;
}

function abaixoDoFundo(sessao: ExerciseSession, hoje: RepRange): boolean {
  const fundo = sessao.repMin ?? hoje.repMin;
  if (fundo === null) return false;
  return workSets(sessao.sets).some((s) => s.reps < fundo);
}

function chegouAoTopo(sessao: ExerciseSession, hoje: RepRange): boolean {
  const topo = sessao.repMax ?? hoje.repMax;
  if (topo === null) return false;
  const trabalho = workSets(sessao.sets);
  // Fez menos séries que as prescritas: não dá para dizer que todas chegaram.
  const prescritas = sessao.targetSets ?? hoje.targetSets ?? 1;
  if (trabalho.length < prescritas) return false;
  const alvoRir = sessao.targetRir ?? hoje.targetRir;
  return trabalho.every((s) => s.reps >= topo && (alvoRir === null || s.rir === null || s.rir >= alvoRir));
}

/**
 * @param today prescrição de hoje (snapshot da sessão em andamento)
 * @param loadStepKg incremento já resolvido
 * @param history sessões anteriores com o exercício, da mais recente para a
 *   mais antiga. Sessões sem série de trabalho são ignoradas.
 */
export function suggestProgression(
  today: RepRange,
  loadStepKg: number,
  history: readonly ExerciseSession[],
): ProgressionVerdict {
  const validas = history.filter((h) => workSets(h.sets).length > 0);
  const ultima = validas[0];
  const fundoHoje = today.repMin ?? REPS_PADRAO;

  if (!ultima) {
    return {
      action: "primeira_vez",
      weightKg: null,
      reps: fundoHoje,
      reason: "Primeira vez: escolha uma carga que deixe o RIR alvo no fundo da faixa.",
    };
  }

  const trabalho = workSets(ultima.sets);
  const carga = maiorCarga(trabalho);
  const menorReps = Math.min(...trabalho.map((s) => s.reps));
  const topoHoje = today.repMax;

  if (today.repMin === null || topoHoje === null) {
    return {
      action: "manter",
      weightKg: carga,
      reps: Math.max(1, menorReps),
      reason: "Sem faixa prescrita: repita a última carga.",
    };
  }

  const penultima = validas[1];
  if (penultima && abaixoDoFundo(ultima, today) && abaixoDoFundo(penultima, today)) {
    if (carga === null || carga <= 0) {
      return {
        action: "manter",
        weightKg: carga,
        reps: today.repMin,
        reason: "Abaixo da faixa em duas sessões seguidas. Sem carga para tirar: mire o fundo da faixa.",
      };
    }
    return {
      action: "reduzir",
      weightKg: Math.max(0, addKg(carga, -loadStepKg)),
      reps: today.repMin,
      reason: "Abaixo do fundo da faixa em duas sessões seguidas.",
    };
  }

  if (chegouAoTopo(ultima, today)) {
    if (carga === null) {
      return {
        action: "manter",
        weightKg: null,
        reps: Math.min(100, menorReps + 1),
        reason: "Topo da faixa só com o corpo: acrescente uma repetição ou uma carga adicional.",
      };
    }
    return {
      action: "subir",
      weightKg: addKg(carga, loadStepKg),
      reps: today.repMin,
      reason: "Todas as séries no topo da faixa dentro do RIR alvo.",
    };
  }

  return {
    action: "manter",
    weightKg: carga,
    reps: Math.min(topoHoje, Math.max(today.repMin, menorReps + 1)),
    reason: "Mesma carga, buscando uma repetição a mais.",
  };
}
