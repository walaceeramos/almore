import { cn } from "@/core/utils/cn";

/**
 * Enquanto os dados do aparelho chegam. Leitura local leva milissegundos,
 * mas o primeiro render acontece antes dela — sem isto a tela piscaria
 * vazia ou com "nenhum registro".
 */
export function Loading({ full, className }: { full?: boolean; className?: string }) {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className={cn("flex items-center justify-center", full ? "min-h-dvh" : "py-16", className)}
    >
      <span className="size-6 animate-spin rounded-full border-2 border-line border-t-brand" aria-hidden />
    </div>
  );
}
