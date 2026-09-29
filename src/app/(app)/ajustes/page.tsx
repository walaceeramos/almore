import { requireUser } from "@/core/auth/session";
import { Card, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Ajustes · Almore" };

export default async function AjustesPage() {
  const user = await requireUser();
  const p = user.profile;

  const linhas: [string, string][] = [
    ["Nome", p?.displayName ?? "—"],
    ["E-mail", user.email],
    ["Altura", p?.heightCm ? `${p.heightCm} cm` : "—"],
    ["Peso inicial", p?.startingWeightKg ? `${p.startingWeightKg} kg` : "—"],
    ["Meta semanal", `${p?.weeklyTarget ?? 0} treinos`],
    ["Fuso horário", p?.timezone ?? "—"],
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-condensed text-3xl font-bold">Ajustes</h1>

      <Card className="divide-y divide-line p-0">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo} className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted">{rotulo}</span>
            <span>{valor}</span>
          </div>
        ))}
      </Card>

      <div className="space-y-2">
        <CardTitle>Em breve</CardTitle>
        <p className="text-sm text-muted">
          Edição de perfil, preferências, exportação de dados e exclusão de conta entram nas fases seguintes.
        </p>
      </div>
    </div>
  );
}
