import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 text-center">
      <p className="font-condensed text-5xl font-bold">404</p>
      <p className="mt-2 text-muted">Essa página não existe.</p>
      <Link href="/inicio" className="mt-6 text-brand hover:underline">
        Voltar para o início
      </Link>
    </main>
  );
}
