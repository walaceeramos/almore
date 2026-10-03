import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/core/auth/session";
import { listMuscles } from "@/features/exercises/queries";
import { NovoExercicioForm } from "./form";

export const metadata = { title: "Novo exercício · Almore" };

export default async function NovoExercicioPage() {
  await requireUser();
  const muscles = await listMuscles();

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
