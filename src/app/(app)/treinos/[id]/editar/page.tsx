import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/core/auth/session";
import { getRoutine } from "@/features/routines/queries";
import { listExercises } from "@/features/exercises/queries";
import { EQUIPMENT_LABEL } from "@/features/exercises/labels";
import type { PickableExercise } from "@/components/exercise-picker";
import { Editor } from "./editor";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getRoutine(id);
  return { title: r ? `Editar ${r.name} · Almore` : "Editar programa · Almore" };
}

export default async function EditarProgramaPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  // A página é camada de app, então pode falar com as duas features e
  // converter. O seletor em si não conhece nenhuma delas.
  const [programa, catalogo] = await Promise.all([getRoutine(id), listExercises({})]);
  if (!programa) notFound();

  const exercicios: PickableExercise[] = catalogo.map((e) => ({
    id: e.id,
    name: e.name,
    muscleName: e.muscles.find((m) => m.role === "primario")?.name ?? null,
    equipmentLabel: EQUIPMENT_LABEL[e.equipment] ?? e.equipment,
    isOwn: e.ownerId === user.id,
  }));

  return (
    <div className="space-y-5">
      <Link
        href={`/treinos/${programa.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-body"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {programa.name}
      </Link>

      <div>
        <h1 className="font-condensed text-2xl font-semibold">Editar programa</h1>
        <p className="mt-1 text-sm text-muted">
          Cada alteração é salva na hora. Não existe botão de salvar tudo no fim.
        </p>
      </div>

      <Editor programa={programa} exercicios={exercicios} />
    </div>
  );
}
