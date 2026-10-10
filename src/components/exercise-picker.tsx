"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Forma mínima que o seletor precisa para desenhar uma linha.
 *
 * Declarada aqui, e não importada de `features/exercises`, porque uma
 * feature não importa de outra e este componente serve tanto o editor de
 * programa (Fase 3) quanto o modo execução (Fase 4). Quem busca os dados é
 * a página, que é camada de app e pode falar com as duas features; ela
 * converte para esta forma antes de passar adiante.
 */
export type PickableExercise = {
  id: string;
  name: string;
  /** Grupo muscular primário já resolvido, para a linha secundária. */
  muscleName: string | null;
  /** Equipamento já traduzido, para a linha secundária. */
  equipmentLabel: string;
  /** Verdadeiro para exercício personalizado do usuário. */
  isOwn: boolean;
};

type Props = {
  exercises: PickableExercise[];
  onPick: (exercise: PickableExercise) => void;
  onClose: () => void;
  /** Ids já presentes; aparecem marcados e não podem ser escolhidos de novo. */
  disabledIds?: string[];
  title?: string;
};

/**
 * Folha de seleção de exercício, em tela cheia no celular.
 *
 * A busca é local: a lista inteira já veio do servidor, e filtrar em
 * memória responde a cada tecla sem ida à rede — o que importa dentro da
 * academia, onde o sinal é ruim.
 */
export function ExercisePicker({ exercises, onPick, onClose, disabledIds = [], title = "Adicionar exercício" }: Props) {
  const [busca, setBusca] = useState("");
  const jaUsados = useMemo(() => new Set(disabledIds), [disabledIds]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return exercises;
    return exercises.filter(
      (e) =>
        e.name.toLowerCase().includes(termo) ||
        (e.muscleName ?? "").toLowerCase().includes(termo) ||
        e.equipmentLabel.toLowerCase().includes(termo),
    );
  }, [exercises, busca]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink" role="dialog" aria-modal="true" aria-label={title}>
      <header className="flex items-center gap-2 border-b border-line px-3 pt-[env(safe-area-inset-top,0px)]">
        <div className="flex h-14 flex-1 items-center">
          <h2 className="font-condensed text-lg font-semibold">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="flex size-11 items-center justify-center rounded text-muted hover:bg-raised"
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div className="border-b border-line p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar exercício"
            aria-label="Buscar exercício"
            autoFocus
            className="min-h-11 w-full rounded border border-line bg-surface pl-9 pr-3 text-[16px] placeholder:text-faint"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom,0px)]">
        {visiveis.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            Nenhum exercício encontrado para “{busca.trim()}”.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {visiveis.map((e) => {
              const usado = jaUsados.has(e.id);
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    disabled={usado}
                    onClick={() => onPick(e)}
                    className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface disabled:opacity-45 disabled:hover:bg-transparent"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15.5px] font-medium">{e.name}</span>
                      <span className="mt-0.5 block text-[13px] text-muted">
                        {e.muscleName ?? "Sem grupo"} · {e.equipmentLabel}
                      </span>
                    </span>
                    {usado ? <Badge>no dia</Badge> : e.isOwn ? <Badge tone="brand">meu</Badge> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
