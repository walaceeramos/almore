import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NovoProgramaForm } from "./form";

export const metadata = { title: "Novo programa · SériePro" };

export default function NovoProgramaPage() {
  return (
    <div className="space-y-6">
      <Link href="/treinos" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-body">
        <ArrowLeft className="size-4" aria-hidden />
        Treinos
      </Link>

      <div>
        <h1 className="font-condensed text-2xl font-semibold">Novo programa</h1>
        <p className="mt-1 text-sm text-muted">
          Comece pelo esqueleto. Os exercícios entram no editor, em seguida.
        </p>
      </div>

      <NovoProgramaForm />
    </div>
  );
}
