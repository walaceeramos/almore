import { CATALOG, MUSCLES } from "./catalog";
import { db } from "./db";
import type { CatalogExercise, Muscle } from "./types";

/**
 * Exercícios vistos de qualquer feature: o catálogo global, que vem dentro
 * do app, mais os personalizados guardados no aparelho.
 *
 * Mora em `core` porque programas, execução e histórico precisam do nome,
 * do equipamento e do incremento de um exercício, e uma feature não
 * importa de outra.
 */

export type AnyExercise = CatalogExercise & {
  /** Verdadeiro para exercício criado pelo usuário. */
  isCustom: boolean;
  archivedAt: string | null;
};

const MUSCLE_BY_ID = new Map(MUSCLES.map((m) => [m.id, m]));

export function listMuscles(): Muscle[] {
  return [...MUSCLES].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function muscleName(id: string): string {
  return MUSCLE_BY_ID.get(id)?.name ?? id;
}

/**
 * Todos, inclusive arquivados: o histórico aponta para eles e precisa do
 * nome. Quem lista para escolha filtra os arquivados.
 */
export async function allExercises(): Promise<AnyExercise[]> {
  const proprios = await db.customExercises.toArray();
  return [
    ...CATALOG.map((e) => ({ ...e, isCustom: false, archivedAt: null })),
    ...proprios.map((e) => ({ ...e, isCustom: true })),
  ];
}

/** Mapa por id, para resolver muitas referências de uma vez. */
export async function exerciseMap(): Promise<Map<string, AnyExercise>> {
  return new Map((await allExercises()).map((e) => [e.id, e]));
}

export async function findExercise(id: string): Promise<AnyExercise | null> {
  const doCatalogo = CATALOG.find((e) => e.id === id);
  if (doCatalogo) return { ...doCatalogo, isCustom: false, archivedAt: null };
  const proprio = await db.customExercises.get(id);
  return proprio ? { ...proprio, isCustom: true } : null;
}
