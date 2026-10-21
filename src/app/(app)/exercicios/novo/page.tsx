import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MUSCLES } from "@/core/data/catalog";
import { NovoExercicioForm } from "./form";

export const metadata = { title: "Novo exercício · SériePro" };

/**
 * Os grupos musculares vêm do catálogo dentro do app, então dá para ler
 * aqui no servidor — direto do catálogo, sem passar pelo banco do
 * aparelho, que só existe no navegador.
 */
export default function NovoExercicioPage() {
  const muscles = [...MUSCLES].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-5">
      <Link href="/exercicios" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-body">
        <ArrowLeft className="size-4" aria-hidden />
        Exercícios
      </Link>

      <div>
        <h1 className="font-condensed text-3xl font-bold">Novo exercício</h1>
        <p className="mt-1 text-sm text-muted">
          Só cadastre o que não existe no catálogo. O grupo muscular define como o volume será contado depois.
        </p>
      </div>

      <NovoExercicioForm muscles={muscles} />
    </div>
  );
}
