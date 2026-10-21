import { TreinoHistoricoView } from "./view";

export const metadata = { title: "Treino · SériePro" };

export default async function TreinoHistoricoPage({ params }: { params: Promise<{ sessaoId: string }> }) {
  const { sessaoId } = await params;
  return <TreinoHistoricoView sessaoId={sessaoId} />;
}
