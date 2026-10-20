import { Suspense } from "react";
import { Loading } from "@/components/ui/loading";
import { ExerciciosView } from "./view";

export const metadata = { title: "Exercícios · Almore" };

/** Suspense porque a tela lê os filtros da URL no cliente. */
export default function ExerciciosPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ExerciciosView />
    </Suspense>
  );
}
