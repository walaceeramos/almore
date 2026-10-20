"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Trophy } from "lucide-react";
import { getSession, listSessionRecords } from "@/features/sessions/queries";
import { Loading } from "@/components/ui/loading";
import { RECORD_LABEL, recordValue } from "@/features/sessions/labels";
import { tonnageKg } from "@/core/domain/volume";
import { durationLabel } from "@/core/utils/date";
import { kg } from "@/core/utils/format";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ConcluirForm } from "./form";

const NUMERO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function Numero({ rotulo, valor, sufixo }: { rotulo: string; valor: string; sufixo?: string }) {
  return (
    <Card>
      <p className="text-xs leading-tight text-faint">{rotulo}</p>
      <p className="font-condensed text-2xl font-bold tabular-nums">
        {valor}
        {sufixo && <span className="text-base text-muted"> {sufixo}</span>}
      </p>
    </Card>
  );
}

export function ResumoView({ sessaoId }: { sessaoId: string }) {
  const dados = useLiveQuery(async () => {
    const sessao = await getSession(sessaoId);
    // Só existem depois de concluir: é a conclusão que recalcula os recordes.
    const recordes = sessao?.status === "concluida" ? await listSessionRecords(sessaoId) : [];
    return { sessao, recordes };
  }, [sessaoId]);

  if (dados === undefined) return <Loading full />;
  const { sessao, recordes } = dados;
  if (!sessao) {
    return (
      <main className="mx-auto max-w-sm px-5 py-16 text-center">
        <p className="font-condensed text-2xl font-semibold">Treino não encontrado</p>
        <Link href="/inicio" className="mt-6 inline-block text-brand hover:underline">
          Voltar ao início
        </Link>
      </main>
    );
  }

  const concluida = sessao.status === "concluida";
  const fim = sessao.finishedAt ?? new Date();
  const todas = sessao.exercises.flatMap((e) => e.sets);
  const trabalho = todas.filter((s) => s.kind === "trabalho").length;
  const toneladas = tonnageKg(todas);

  return (
    <main className="mx-auto max-w-lg space-y-5 px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))]">
      {!concluida && (
        <Link
          href={`/executar/${sessao.id}`}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-body"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Voltar ao treino
        </Link>
      )}

      <div>
        <p className="text-xs text-faint">{concluida ? "Treino concluído" : "Antes de concluir"}</p>
        <h1 className="font-condensed text-3xl font-bold leading-tight">{sessao.title}</h1>
      </div>

      <section className="grid grid-cols-3 gap-2">
        <Numero rotulo="Duração" valor={durationLabel((fim.getTime() - sessao.startedAt.getTime()) / 1000)} />
        <Numero rotulo="Séries de trabalho" valor={String(trabalho)} />
        <Numero rotulo="Tonelagem" valor={NUMERO.format(toneladas)} sufixo="kg" />
      </section>
      <p className="-mt-3 text-xs text-faint">
        Tonelagem soma carga × repetições nas séries de trabalho com carga. Aquecimento e peso corporal não entram.
      </p>

      {recordes.length > 0 && (
        <section className="space-y-2">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-4 text-brand" aria-hidden />
            Recordes batidos
          </CardTitle>
          <ul className="divide-y divide-line rounded border border-brand/40 bg-brand/5">
            {recordes.map((r) => (
              <li key={`${r.exerciseId}-${r.kind}`} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium">{r.exerciseName}</span>
                  <span className="text-[13px] text-muted">{RECORD_LABEL[r.kind]}</span>
                </span>
                <span className="shrink-0 font-condensed text-lg tabular-nums text-brand">{recordValue(r)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <CardTitle>Exercícios</CardTitle>
        <ul className="divide-y divide-line rounded border border-line bg-surface">
          {sessao.exercises.map((e) => (
            <li key={e.id} className="px-4 py-3">
              <p className="text-[15px] font-medium">{e.exerciseName}</p>
              {e.sets.length === 0 ? (
                <p className="mt-0.5 text-[13px] text-faint">Não feito</p>
              ) : (
                <p className="mt-0.5 text-[13px] tabular-nums text-muted">
                  {e.sets.map((s, i) => (
                    <span key={s.id}>
                      {i > 0 && ", "}
                      {s.weightKg === null ? "corpo" : `${kg(s.weightKg.toFixed(2))} kg`} × {s.reps}
                      {s.kind === "aquecimento" && <span className="text-faint"> (aq.)</span>}
                    </span>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {concluida ? (
        <>
          {(sessao.perceivedEffort !== null || sessao.notes) && (
            <Card className="space-y-1">
              {sessao.perceivedEffort !== null && (
                <p className="text-sm">
                  Esforço percebido <Badge tone="brand">{sessao.perceivedEffort}/10</Badge>
                </p>
              )}
              {sessao.notes && <p className="text-sm text-muted">{sessao.notes}</p>}
            </Card>
          )}
          <ButtonLink href="/inicio" full>
            Voltar ao início
          </ButtonLink>
          <ButtonLink href={`/historico/${sessao.id}`} variant="ghost" full>
            Corrigir no histórico
          </ButtonLink>
        </>
      ) : (
        <ConcluirForm sessionId={sessao.id} />
      )}
    </main>
  );
}
