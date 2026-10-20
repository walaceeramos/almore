import { ResumoView } from "./view";

export const metadata = { title: "Resumo do treino · Almore" };

export default async function ResumoPage({ params }: { params: Promise<{ sessaoId: string }> }) {
  const { sessaoId } = await params;
  return <ResumoView sessaoId={sessaoId} />;
}
