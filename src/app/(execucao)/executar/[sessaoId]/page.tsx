import { ExecutarView } from "./view";

export const metadata = { title: "Treino · SériePro" };

export default async function ExecutarPage({ params }: { params: Promise<{ sessaoId: string }> }) {
  const { sessaoId } = await params;
  return <ExecutarView sessaoId={sessaoId} />;
}
