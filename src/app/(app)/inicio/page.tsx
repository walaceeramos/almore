import { requireUser } from "@/core/auth/session";
import { Card, CardTitle, EmptyState } from "@/components/ui/card";

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
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hour12: false,
      timeZone: profile?.timezone ?? "America/Sao_Paulo",
    }).format(new Date()),
  );

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
            0<span className="text-lg text-muted">/{profile?.weeklyTarget ?? 0}</span>
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
        <EmptyState
          title="Nenhum treino programado"
          description="A criação de programas chega na próxima fase. Por enquanto, sua conta e seu perfil já estão ativos."
        />
      </section>

      <p className="text-xs text-faint">
        Os três números acima ficam zerados até a fase de execução de treinos existir. Eles estão aqui para
        confirmar que o layout e a leitura do perfil funcionam.
      </p>
    </div>
  );
}
