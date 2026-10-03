import { requireUser } from "@/core/auth/session";
import { OnboardingForm } from "./form";

export const metadata = { title: "Boas-vindas · Almore" };

export default async function BoasVindasPage() {
  const user = await requireUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-condensed text-2xl font-semibold">Vamos conhecer você</h1>
        <p className="mt-1 text-sm text-muted">
          São os dados mínimos para o sistema fazer contas corretas depois. Dá para mudar tudo em Ajustes.
        </p>
      </div>

      <OnboardingForm defaultName={user.profile?.displayName ?? ""} />
    </div>
  );
}
