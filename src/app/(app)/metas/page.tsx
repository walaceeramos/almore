import { requireUser } from "@/core/auth/session";
import { EmptyState } from "@/components/ui/card";

export const metadata = { title: "Metas · Almore" };

export default async function Page() {
  await requireUser();
  return (
    <div className="space-y-6">
      <h1 className="font-condensed text-3xl font-bold">Metas</h1>
      <EmptyState title="Ainda não disponível" description="Metas e acompanhamento chegam na fase 8." />
    </div>
  );
}
