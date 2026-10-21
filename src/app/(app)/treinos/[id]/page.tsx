import { ProgramaView } from "./view";

export const metadata = { title: "Programa · SériePro" };

export default async function ProgramaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProgramaView id={id} />;
}
