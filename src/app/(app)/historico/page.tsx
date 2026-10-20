import Link from "next/link";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { requireUser } from "@/core/auth/session";
import { getOpenSession, listFinishedBetween } from "@/features/sessions/queries";
import { listRoutines } from "@/features/routines/queries";
import { tonnageKg } from "@/core/domain/volume";
import { durationLabel, localDate, localTime, zonedToUtc } from "@/core/utils/date";
import { cn } from "@/core/utils/cn";
import { Card, EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Histórico · Almore" };

const NUMERO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** "2026-10" ± n meses. */
function mudarMes(mes: string, n: number): string {
  const [y, m] = mes.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

function href(mes: string, programa: string | null): string {
  const p = new URLSearchParams({ mes });
  if (programa) p.set("programa", programa);
  return `/historico?${p.toString()}`;
}

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; programa?: string }>;
}) {
  const user = await requireUser();
  const fuso = user.profile?.timezone ?? "America/Sao_Paulo";
  const params = await searchParams;

  const hoje = localDate(new Date(), fuso);
  const mesAtual = hoje.slice(0, 7);
  // Mês inválido ou no futuro volta para o atual; comparar "AAAA-MM" é comparar datas.
  const mes = params.mes && /^\d{4}-\d{2}$/.test(params.mes) && params.mes <= mesAtual ? params.mes : mesAtual;
  const programa = params.programa && /^[0-9a-f-]{36}$/i.test(params.programa) ? params.programa : null;

  // Limites do mês no fuso do usuário, convertidos para o UTC do banco.
  const inicio = zonedToUtc(`${mes}-01`, "00:00", fuso);
  const fim = zonedToUtc(`${mudarMes(mes, 1)}-01`, "00:00", fuso);

  const [aberta, programas, treinos] = await Promise.all([
    getOpenSession(),
    listRoutines(),
    listFinishedBetween(inicio, fim, programa ?? undefined),
  ]);

  // Agrupa por dia local, mantendo a ordem do mais recente.
  const porDia = new Map<string, typeof treinos>();
  for (const t of treinos) {
    const dia = localDate(t.startedAt, fuso);
    porDia.set(dia, [...(porDia.get(dia) ?? []), t]);
  }

  const [ano, mesNum] = mes.split("-").map(Number) as [number, number];
  const diasNoMes = new Date(Date.UTC(ano, mesNum, 0)).getUTCDate();
  const deslocamento = (new Date(Date.UTC(ano, mesNum - 1, 1)).getUTCDay() + 6) % 7;
  const tituloMes = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(ano, mesNum - 1, 15)),
  );
  const tituloDia = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  return (
    <div className="space-y-5">
      <h1 className="font-condensed text-3xl font-bold">Histórico</h1>

      {aberta && (
        <Card className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-faint">Em andamento</p>
            <p className="truncate font-condensed text-lg font-semibold">{aberta.title}</p>
          </div>
          <ButtonLink href={`/executar/${aberta.id}`}>
            <Play className="size-4" aria-hidden />
            Retomar
          </ButtonLink>
        </Card>
      )}

      {programas.length > 0 && (
        <nav aria-label="Filtrar por programa" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {[{ id: null as string | null, name: "Todos" }, ...programas].map((p) => {
            const ativo = p.id === programa;
            return (
              <Link
                key={p.id ?? "todos"}
                href={href(mes, p.id)}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex min-h-11 shrink-0 items-center rounded border px-3 text-sm",
                  ativo ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:bg-surface",
                )}
              >
                {p.name}
              </Link>
            );
          })}
        </nav>
      )}

      <Card className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <Link
            href={href(mudarMes(mes, -1), programa)}
            aria-label="Mês anterior"
            className="flex size-11 items-center justify-center rounded text-muted hover:bg-raised"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <p className="font-condensed text-lg font-semibold capitalize">{tituloMes}</p>
          {mes < mesAtual ? (
            <Link
              href={href(mudarMes(mes, 1), programa)}
              aria-label="Próximo mês"
              className="flex size-11 items-center justify-center rounded text-muted hover:bg-raised"
            >
              <ChevronRight className="size-5" aria-hidden />
            </Link>
          ) : (
            <span className="size-11" aria-hidden />
          )}
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {SEMANA.map((d) => (
            <span key={d} className="pb-1 text-[11px] text-faint">
              {d}
            </span>
          ))}
          {Array.from({ length: deslocamento }, (_, i) => (
            <span key={`vazio-${i}`} aria-hidden />
          ))}
          {Array.from({ length: diasNoMes }, (_, i) => {
            const dia = `${mes}-${String(i + 1).padStart(2, "0")}`;
            const qtd = porDia.get(dia)?.length ?? 0;
            const ehHoje = dia === hoje;
            const conteudo = (
              <>
                {i + 1}
                {qtd > 0 && <span className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-ink" />}
              </>
            );
            return qtd > 0 ? (
              <a
                key={dia}
                href={`#dia-${dia}`}
                aria-label={`${i + 1}: ${qtd} ${qtd === 1 ? "treino" : "treinos"}`}
                className="relative flex aspect-square min-h-9 items-center justify-center rounded bg-brand text-sm font-semibold tabular-nums text-ink"
              >
                {conteudo}
              </a>
            ) : (
              <span
                key={dia}
                className={cn(
                  "relative flex aspect-square min-h-9 items-center justify-center rounded text-sm tabular-nums text-muted",
                  ehHoje && "border border-line text-body",
                )}
              >
                {conteudo}
              </span>
            );
          })}
        </div>
        <p className="mt-2 text-center text-xs text-faint">
          {treinos.length} {treinos.length === 1 ? "treino concluído" : "treinos concluídos"} no mês
        </p>
      </Card>

      {treinos.length === 0 ? (
        <EmptyState
          title="Nenhum treino neste mês"
          description={programa ? "Nenhum treino deste programa no mês. Tente outro mês ou “Todos”." : "Os treinos concluídos aparecem aqui."}
        />
      ) : (
        <div className="space-y-4">
          {[...porDia.entries()].map(([dia, lista]) => {
            const [y, m, d] = dia.split("-").map(Number) as [number, number, number];
            return (
              <section key={dia} id={`dia-${dia}`} className="scroll-mt-20 space-y-2">
                <h2 className="text-sm capitalize text-muted">{tituloDia.format(new Date(Date.UTC(y, m - 1, d, 12)))}</h2>
                <ul className="space-y-2">
                  {lista.map((t) => {
                    const trabalho = t.sets.filter((s) => s.kind === "trabalho").length;
                    const toneladas = tonnageKg(t.sets);
                    return (
                      <li key={t.id}>
                        <Link
                          href={`/historico/${t.id}`}
                          className="block rounded border border-line bg-surface px-4 py-3 hover:bg-raised"
                        >
                          <p className="truncate text-[15.5px] font-medium">{t.title}</p>
                          <p className="mt-0.5 text-[13px] text-muted">
                            {localTime(t.startedAt, fuso)} ·{" "}
                            {durationLabel((t.finishedAt.getTime() - t.startedAt.getTime()) / 1000)} · {trabalho}{" "}
                            {trabalho === 1 ? "série" : "séries"}
                            {toneladas > 0 && ` · ${NUMERO.format(toneladas)} kg`}
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
