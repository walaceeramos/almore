import Link from "next/link";
import { SignInForm } from "./form";

export const metadata = { title: "Entrar · Almore" };

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string; erro?: string }>;
}) {
  const { proximo, erro } = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-condensed text-2xl font-semibold">Entrar</h1>
        <p className="mt-1 text-sm text-muted">Use o e-mail cadastrado.</p>
      </div>

      {erro === "link_invalido" && (
        <p className="rounded border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
          O link expirou ou já foi usado. Peça um novo.
        </p>
      )}

      <SignInForm proximo={proximo} />

      <div className="space-y-2 text-center text-sm">
        <p>
          <Link href="/recuperar-senha" className="text-brand hover:underline">
            Esqueci minha senha
          </Link>
        </p>
        <p className="text-muted">
          Ainda não tem conta?{" "}
          <Link href="/cadastrar" className="text-brand hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
