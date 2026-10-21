import { Logo } from "@/components/layout/logo";
import { OnboardingForm } from "./form";

export const metadata = { title: "Boas-vindas · SériePro" };

export default function BoasVindasPage() {
  return (
    <div className="space-y-6">
      <div>
        <Logo />
        <h1 className="mt-4 font-condensed text-2xl font-semibold">Vamos conhecer você</h1>
        <p className="mt-1 text-sm text-muted">
          São os dados mínimos para o sistema fazer contas corretas depois. Tudo fica guardado neste aparelho.
        </p>
      </div>

      <OnboardingForm />
    </div>
  );
}
