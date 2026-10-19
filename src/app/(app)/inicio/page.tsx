import { Play } from "lucide-react";
import { requireUser } from "@/core/auth/session";
import { getActiveRoutine } from "@/features/routines/queries";
import { getLastTrainedDayId, getOpenSession, listFinishedSince } from "@/features/sessions/queries";
import { StartSessionForm } from "@/features/sessions/components/start-session-form";
import { nextDayId } from "@/core/domain/next-day";
import { localDate, localWeekStart } from "@/core/utils/date";
import { Card, CardTitle, EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Início · Almore" };

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

  // Oito dias para trás cobrem a semana inteira em qualquer fuso; o recorte
  // exato, a partir de segunda-feira no fuso do usuário, é feito aqui.
  const [aberta, programa, concluidas] = await Promise.all([
    getOpenSession(),
    getActiveRoutine(),
    listFinishedSince(new Date(agora.getTime() - 8 * 86_400_000)),
  ]);
  const segunda = localWeekStart(agora, fuso);
  const naSemana = concluidas.filter((d) => localDate(d, fuso) >= segunda).length;

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
            <span className="text-lg text-muted">/{profile?.weeklyTarget ?? 0}</span>
          </p>
          <p className="text-xs text-muted">treinos concluídos</p>
        </Card>
        <Card>
          <p className="text-xs text-faint">Sequência</p>
          <p className="font-condensed text-3xl font-bold tabular-nums">0</p>
          <p className="text-xs text-muted">semanas na meta</p>
        </Card>
        <Card>
          <p className="text-xs text-faint">Volume da semana</p>
          <p className="font-condensed text-3xl font-bold tabular-nums">0</p>
          <p className="text-xs text-muted">séries de trabalho</p>
        </Card>
      </section>

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

      <p className="text-xs text-faint">
        Sequência e volume da semana ficam zerados até as regras de consistência e volume chegarem, na fase 5.
      </p>
    </div>
  );
}
