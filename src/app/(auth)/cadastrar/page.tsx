import Link from "next/link";
import { SignUpForm } from "./form";

export const metadata = { title: "Criar conta · Almore" };

export default function CadastrarPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-condensed text-2xl font-semibold">Criar conta</h1>
        <p className="mt-1 text-sm text-muted">Leva menos de um minuto.</p>
      </div>

      <SignUpForm />

      <p className="text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/entrar" className="text-brand hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
