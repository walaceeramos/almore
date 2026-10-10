import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/core/auth/session";
import { NovoProgramaForm } from "./form";

export const metadata = { title: "Novo programa · Almore" };

export default async function NovoProgramaPage() {
  const user = await requireUser();

  // A meta semanal do perfil é o palpite mais informado que temos para
  // quantos dias o programa deve ter.
  const sugestao = Math.min(7, Math.max(1, user.profile?.weeklyTarget ?? 3));

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

      <NovoProgramaForm defaultDayCount={sugestao} />
    </div>
  );
}
