import { Suspense } from "react";
import { Loading } from "@/components/ui/loading";
import { HistoricoView } from "./view";

export const metadata = { title: "Histórico · Almore" };

/** Suspense porque a tela lê o mês e o programa da URL no cliente. */
export default function HistoricoPage() {
  return (
    <Suspense fallback={<Loading />}>
      <HistoricoView />
    </Suspense>
  );
}
