import { requireUser } from "@/core/auth/session";
import { EmptyState } from "@/components/ui/card";

export const metadata = { title: "Exercícios · Almore" };

export default async function Page() {
  await requireUser();
  return (
    <div className="space-y-6">
      <h1 className="font-condensed text-3xl font-bold">Exercícios</h1>
      <EmptyState title="Ainda não disponível" description="O catálogo de exercícios chega na fase 2." />
    </div>
  );
}
