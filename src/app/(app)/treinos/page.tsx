import { requireUser } from "@/core/auth/session";
import { EmptyState } from "@/components/ui/card";

export const metadata = { title: "Treinos · Almore" };

export default async function Page() {
  await requireUser();
  return (
    <div className="space-y-6">
      <h1 className="font-condensed text-3xl font-bold">Treinos</h1>
      <EmptyState title="Ainda não disponível" description="Criar e organizar programas de treino chega na fase 3." />
    </div>
  );
}
