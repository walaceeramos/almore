import { Play } from "lucide-react";
import { requireUser } from "@/core/auth/session";
import { getActiveRoutine } from "@/features/routines/queries";
import {
  getLastTrainedDayId,
  getOpenSession,
  listFinishedSetsSince,
  listFinishedSince,
} from "@/features/sessions/queries";
import { StartSessionForm } from "@/features/sessions/components/start-session-form";
import { nextDayId } from "@/core/domain/next-day";
import { adherence, weekStartOf, weekStreak } from "@/core/domain/consistency";
import { setsPerMuscle } from "@/core/domain/volume";
import { localDate } from "@/core/utils/date";
import { Card, CardTitle, EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Início · Almore" };

const PERCENTUAL = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });
const NUMERO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

const FOCO: Record<string, string> = {
  hipertrofia: "Ganho de massa",
  forca: "Força",
  emagrecimento: "Perda de gordura",
  recomposicao: "Recomposição",
  saude: "Saúde",
};

function saudacao(hora: number) {
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function InicioPage() {
  const user = await requireUser();
  const profile = user.profile;
  const primeiroNome = (profile?.displayName ?? "").split(" ")[0] ?? "";
  const fuso = profile?.timezone ?? "America/Sao_Paulo";
  const agora = new Date();
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hour12: false,
      timeZone: fuso,
    }).format(agora),
  );

  // Um ano de datas de conclusão alimenta a sequência; oito dias de séries
  // cobrem a semana atual em qualquer fuso. O recorte exato, a partir de
  // segunda-feira no fuso do usuário, é feito aqui.
  const DIA = 86_400_000;
  const [aberta, programa, concluidas, semanaDeSeries] = await Promise.all([
    getOpenSession(),
    getActiveRoutine(),
    listFinishedSince(new Date(agora.getTime() - 53 * 7 * DIA)),
    listFinishedSetsSince(new Date(agora.getTime() - 8 * DIA)),
  ]);

  const meta = profile?.weeklyTarget ?? 0;
  const hoje = localDate(agora, fuso);
  const segunda = weekStartOf(hoje);
  const datas = concluidas.map((d) => localDate(d, fuso));
  const naSemana = datas.filter((d) => d >= segunda).length;
  const sequencia = weekStreak(datas, meta, hoje);
  const aderencia = adherence(datas, meta, hoje);

  const seriesDaSemana = semanaDeSeries.sets.filter((s) => localDate(s.finishedAt, fuso) >= segunda);
  const trabalhoNaSemana = seriesDaSemana.filter((s) => s.kind === "trabalho").length;
  const nomesMusculo = new Map(
    Object.values(semanaDeSeries.muscles)
      .flat()
      .map((m) => [m.id, m.name]),
  );
  const porMusculo = Object.entries(
    setsPerMuscle(
      seriesDaSemana.map((s) => ({
        kind: s.kind,
        muscles: (semanaDeSeries.muscles[s.exerciseId] ?? []).map((m) => ({
          muscleId: m.id,
          contribution: m.contribution,
        })),
      })),
    ),
  )
    .map(([id, series]) => ({ nome: nomesMusculo.get(id) ?? id, series }))
    .sort((a, b) => b.series - a.series || a.nome.localeCompare(b.nome));

  const proximoId =
    programa && !aberta
      ? nextDayId(
          programa.days.map((d) => d.id),
          await getLastTrainedDayId(programa.id),
        )
      : null;
  const proximo = programa?.days.find((d) => d.id === proximoId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-condensed text-3xl font-bold leading-tight">
          {saudacao(hora)}, {primeiroNome}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {profile?.focus ? FOCO[profile.focus] : "Objetivo não definido"} ·{" "}
          {profile?.weeklyTarget ?? 0} treinos por semana
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-faint">Esta semana</p>
          <p className="font-condensed text-3xl font-bold tabular-nums">
            {naSemana}
            <span className="text-lg text-muted">/{meta}</span>
          </p>
          <p className="text-xs text-muted">treinos concluídos</p>
        </Card>
        <Card>
          <p className="text-xs text-faint">Sequência</p>
          <p className="font-condensed text-3xl font-bold tabular-nums">{sequencia}</p>
          <p className="text-xs text-muted">
            {sequencia === 1 ? "semana na meta" : "semanas na meta"} · aderência{" "}
            {PERCENTUAL.format(aderencia)} em 4 semanas
          </p>
        </Card>
        <Card>
          <p className="text-xs text-faint">Volume da semana</p>
          <p className="font-condensed text-3xl font-bold tabular-nums">{trabalhoNaSemana}</p>
          <p className="text-xs text-muted">séries de trabalho</p>
        </Card>
      </section>

      {porMusculo.length > 0 && (
        <section className="space-y-2">
          <CardTitle>Séries por grupo nesta semana</CardTitle>
          <Card className="space-y-1.5">
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              {porMusculo.map((m) => (
                <li key={m.nome} className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-muted">{m.nome}</span>
                  <span className="font-condensed text-base tabular-nums">{NUMERO.format(m.series)}</span>
                </li>
              ))}
            </ul>
            <p className="border-t border-line pt-2 text-xs text-faint">
              Músculo primário conta 1 série; secundário, 0,5. É uma convenção para comparar semanas, não uma medida
              fisiológica.
            </p>
          </Card>
        </section>
      )}

      <section className="space-y-3">
        <CardTitle>Treino de hoje</CardTitle>
        {aberta ? (
          <Card className="space-y-3">
            <div>
              <p className="text-xs text-faint">Em andamento</p>
              <p className="font-condensed text-xl font-semibold">{aberta.title}</p>
            </div>
            <ButtonLink href={`/executar/${aberta.id}`} full>
              <Play className="size-4" aria-hidden />
              Retomar treino
            </ButtonLink>
          </Card>
        ) : programa && proximo ? (
          <Card className="space-y-3">
            <div>
              <p className="text-xs text-faint">{programa.name} · próximo da sequência</p>
              <p className="font-condensed text-xl font-semibold">{proximo.name}</p>
              <p className="mt-0.5 text-[13px] text-muted">
                {proximo.exercises.length === 0
                  ? "Sem exercícios ainda"
                  : proximo.exercises.map((e) => e.exerciseName).join(" · ")}
              </p>
            </div>
            <StartSessionForm
              days={programa.days.map((d) => ({ id: d.id, name: d.name }))}
              defaultDayId={proximo.id}
            />
          </Card>
        ) : (
          <EmptyState
            title="Nenhum programa ativo"
            description="Crie um programa ou marque um como ativo para ele aparecer aqui."
            action={<ButtonLink href="/treinos">Ver programas</ButtonLink>}
          />
        )}
      </section>
    </div>
  );
}
