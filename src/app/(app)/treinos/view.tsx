"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Copy, Archive, ArchiveRestore, Check } from "lucide-react";
import { listRoutines, type RoutineSummary } from "@/features/routines/queries";
import {
  activateRoutine,
  archiveRoutine,
  unarchiveRoutine,
  duplicateRoutine,
} from "@/features/routines/actions";
import { Card, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";

function resumo(r: RoutineSummary): string {
  const dias = `${r.dayCount} ${r.dayCount === 1 ? "dia" : "dias"}`;
  const exercicios = `${r.exerciseCount} ${r.exerciseCount === 1 ? "exercício" : "exercícios"}`;
  return `${dias} · ${exercicios}`;
}

function idEmFormData(id: string): FormData {
  const fd = new FormData();
  fd.set("id", id);
  return fd;
}

function AcaoIcone({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex size-11 items-center justify-center rounded text-muted transition-colors hover:bg-raised hover:text-body"
    >
      {children}
    </button>
  );
}

function RoutineCard({ r }: { r: RoutineSummary }) {
  const router = useRouter();
  const arquivada = r.archivedAt !== null;

  return (
    <Card className={r.isActive ? "border-brand/40" : undefined}>
      <div className="flex items-start gap-3">
        <Link href={`/treinos/${r.id}`} className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-condensed text-lg font-semibold">{r.name}</h3>
            {r.isActive && <Badge tone="brand">ativo</Badge>}
          </div>
          <p className="mt-0.5 text-[13px] text-muted">{resumo(r)}</p>
          {r.description && <p className="mt-1.5 line-clamp-2 text-sm text-muted">{r.description}</p>}
        </Link>

        <div className="flex shrink-0 items-center">
          {!arquivada && !r.isActive && (
            <AcaoIcone onClick={() => void activateRoutine(idEmFormData(r.id))} label="Tornar este o programa ativo">
              <Check className="size-4" aria-hidden />
            </AcaoIcone>
          )}
          <AcaoIcone
            onClick={async () => {
              const novo = await duplicateRoutine(idEmFormData(r.id));
              if (novo) router.push(`/treinos/${novo}`);
            }}
            label="Duplicar programa"
          >
            <Copy className="size-4" aria-hidden />
          </AcaoIcone>
          {arquivada ? (
            <AcaoIcone onClick={() => void unarchiveRoutine(idEmFormData(r.id))} label="Desarquivar programa">
              <ArchiveRestore className="size-4" aria-hidden />
            </AcaoIcone>
          ) : (
            <AcaoIcone onClick={() => void archiveRoutine(idEmFormData(r.id))} label="Arquivar programa">
              <Archive className="size-4" aria-hidden />
            </AcaoIcone>
          )}
        </div>
      </div>
    </Card>
  );
}

export function TreinosView() {
  const programas = useLiveQuery(() => listRoutines(), []);
  if (programas === undefined) return <Loading />;

  const ativos = programas.filter((r) => r.archivedAt === null);
  const arquivados = programas.filter((r) => r.archivedAt !== null);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-condensed text-3xl font-bold">Treinos</h1>
          <p className="mt-0.5 text-sm text-muted">
            {ativos.length} {ativos.length === 1 ? "programa" : "programas"}
          </p>
        </div>
        <Link
          href="/treinos/novo"
          className="inline-flex min-h-11 items-center gap-1.5 rounded bg-brand px-3 text-sm font-semibold text-ink"
        >
          <Plus className="size-4" aria-hidden />
          Novo
        </Link>
      </div>

      {ativos.length === 0 ? (
        <EmptyState
          title="Nenhum programa ainda"
          description="Um programa é a sua divisão de treino: os dias e, em cada dia, os exercícios com séries, faixa de repetições e descanso."
          action={<ButtonLink href="/treinos/novo">Criar meu primeiro programa</ButtonLink>}
        />
      ) : (
        <ul className="space-y-3">
          {ativos.map((r) => (
            <li key={r.id}>
              <RoutineCard r={r} />
            </li>
          ))}
        </ul>
      )}

      {arquivados.length > 0 && (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm text-muted">
            Arquivados ({arquivados.length})
          </summary>
          <ul className="mt-2 space-y-3 opacity-60">
            {arquivados.map((r) => (
              <li key={r.id}>
                <RoutineCard r={r} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
