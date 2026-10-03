import { requireUser } from "@/core/auth/session";
import { NovaSenhaForm } from "./form";

export const metadata = { title: "Nova senha · Almore" };

/**
 * Só se chega aqui pelo link do e-mail, que já criou sessão no callback.
 * Sem sessão, `requireUser` manda para o login.
 */
export default async function NovaSenhaPage() {
  await requireUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-condensed text-2xl font-semibold">Definir nova senha</h1>
        <p className="mt-1 text-sm text-muted">
          Depois de salvar, você já entra com ela nos próximos acessos.
        </p>
      </div>

      <NovaSenhaForm />
    </div>
  );
}
