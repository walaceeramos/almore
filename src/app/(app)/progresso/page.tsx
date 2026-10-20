import { EmptyState } from "@/components/ui/card";

export const metadata = { title: "Progresso · Almore" };

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="font-condensed text-3xl font-bold">Progresso</h1>
      <EmptyState title="Ainda não disponível" description="Gráficos de carga, volume e recordes chegam na fase 7." />
    </div>
  );
}
