import Link from "next/link";
import { ResetForm } from "./form";

export const metadata = { title: "Recuperar senha · Almore" };

export default function RecuperarSenhaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-condensed text-2xl font-semibold">Recuperar senha</h1>
        <p className="mt-1 text-sm text-muted">Enviamos um link para você definir uma nova senha.</p>
      </div>

      <ResetForm />

      <p className="text-center text-sm">
        <Link href="/entrar" className="text-brand hover:underline">
          Voltar para entrar
        </Link>
      </p>
    </div>
  );
}
