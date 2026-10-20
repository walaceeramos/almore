"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft } from "lucide-react";
import { getRoutine } from "@/features/routines/queries";
import { listPickableExercises } from "@/features/exercises/picker";
import { EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";
import { Editor } from "./editor";

export function EditarProgramaView({ id }: { id: string }) {
  // A tela é camada de app, então fala com as duas features. O seletor em
  // si não conhece nenhuma delas.
  const dados = useLiveQuery(async () => {
    const [programa, exercicios] = await Promise.all([getRoutine(id), listPickableExercises()]);
    return { programa, exercicios };
  }, [id]);

  if (dados === undefined) return <Loading />;
  const { programa, exercicios } = dados;
  if (!programa) {
    return (
      <EmptyState
        title="Programa não encontrado"
        description="Ele não existe neste aparelho."
        action={<ButtonLink href="/treinos">Ver programas</ButtonLink>}
      />
    );
  }

  return (
    <div className="space-y-5">
      <title>{`Editar ${programa.name} · Almore`}</title>
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
