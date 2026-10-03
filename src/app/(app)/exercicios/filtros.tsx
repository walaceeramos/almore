"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { PATTERN_LABEL, EQUIPMENT_LABEL } from "@/features/exercises/labels";
import { cn } from "@/core/utils/cn";

type Muscle = { id: string; name: string; region: string };

export function Filtros({ muscles }: { muscles: Muscle[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [busca, setBusca] = useState(params.get("busca") ?? "");

  // Debounce: não dispara uma navegação por tecla digitada.
  useEffect(() => {
    const atual = params.get("busca") ?? "";
    if (busca === atual) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (busca.trim()) next.set("busca", busca.trim());
      else next.delete("busca");
      startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
    }, 350);
    return () => clearTimeout(t);
  }, [busca, params, pathname, router]);

  function setParam(chave: string, valor: string) {
    const next = new URLSearchParams(params.toString());
    if (valor) next.set(chave, valor);
    else next.delete(chave);
    startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
  }

  const temFiltro = ["musculo", "equipamento", "padrao", "origem"].some((k) => params.get(k));

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar exercício"
          aria-label="Buscar exercício"
          className="min-h-11 w-full rounded border border-line bg-surface pl-9 pr-3 text-[16px] placeholder:text-faint"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select
          aria-label="Grupo muscular"
          value={params.get("musculo") ?? ""}
          onChange={(e) => setParam("musculo", e.target.value)}
          className="min-h-11 rounded border border-line bg-surface px-2 text-sm"
        >
          <option value="">Todos os músculos</option>
          {muscles.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Equipamento"
          value={params.get("equipamento") ?? ""}
          onChange={(e) => setParam("equipamento", e.target.value)}
          className="min-h-11 rounded border border-line bg-surface px-2 text-sm"
        >
          <option value="">Todo equipamento</option>
          {Object.entries(EQUIPMENT_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>

        <select
          aria-label="Padrão de movimento"
          value={params.get("padrao") ?? ""}
          onChange={(e) => setParam("padrao", e.target.value)}
          className="min-h-11 rounded border border-line bg-surface px-2 text-sm"
        >
          <option value="">Todo padrão</option>
          {Object.entries(PATTERN_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>

        <select
          aria-label="Origem"
          value={params.get("origem") ?? ""}
          onChange={(e) => setParam("origem", e.target.value)}
          className="min-h-11 rounded border border-line bg-surface px-2 text-sm"
        >
          <option value="">Catálogo e meus</option>
          <option value="catalogo">Só o catálogo</option>
          <option value="meus">Só os meus</option>
        </select>
      </div>

      {temFiltro && (
        <button
          type="button"
          onClick={() => {
            const next = new URLSearchParams();
            if (busca.trim()) next.set("busca", busca.trim());
            startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
          }}
          className={cn("inline-flex items-center gap-1.5 text-sm text-brand hover:underline")}
        >
          <X className="size-3.5" aria-hidden />
          Limpar filtros
        </button>
      )}
    </div>
  );
}
