/**
 * Estagnação: três sessões consecutivas sem aumento de carga nem de
 * repetições.
 *
 * O sistema só sinaliza. Nunca altera o programa: a causa pode ser fadiga
 * acumulada, déficit calórico ou sono ruim, e nenhuma delas se resolve
 * trocando o exercício.
 *
 * O desempenho de uma sessão é a série de trabalho mais pesada e, nela, o
 * máximo de repetições. Uma sessão evolui se sobe a carga em relação à
 * sessão anterior, ou se mantém a carga e sobe as repetições.
 *
 * A comparação é sempre com a sessão imediatamente anterior, não com o
 * melhor de todos os tempos: quem reduziu a carga e está subindo de novo
 * está evoluindo, mesmo abaixo do recorde antigo.
 */

import { workSets, type DomainSet } from "./types";

export const STAGNATION_SESSIONS = 3;

type Marca = { carga: number; reps: number };

function marca(sets: readonly DomainSet[]): Marca | null {
  const trabalho = workSets(sets);
  if (trabalho.length === 0) return null;
  // Peso corporal puro conta como carga zero: evolui só por repetições.
  const carga = Math.max(...trabalho.map((s) => s.weightKg ?? 0));
  const reps = Math.max(...trabalho.filter((s) => (s.weightKg ?? 0) === carga).map((s) => s.reps));
  return { carga, reps };
}

function evoluiu(atual: Marca, anterior: Marca): boolean {
  return atual.carga > anterior.carga || (atual.carga === anterior.carga && atual.reps > anterior.reps);
}

/**
 * @param history séries de cada sessão com o exercício, da mais recente
 *   para a mais antiga. Sessões sem série de trabalho são ignoradas.
 */
export function isStagnant(history: readonly (readonly DomainSet[])[]): boolean {
  const marcas = history.map(marca).filter((m): m is Marca => m !== null);
  // Três sessões a julgar, e cada uma precisa da anterior para comparar.
  if (marcas.length < STAGNATION_SESSIONS + 1) return false;

  for (let i = 0; i < STAGNATION_SESSIONS; i++) {
    const atual = marcas[i];
    const anterior = marcas[i + 1];
    if (atual && anterior && evoluiu(atual, anterior)) return false;
  }
  return true;
}
