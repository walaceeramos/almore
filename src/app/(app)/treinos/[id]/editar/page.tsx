import { EditarProgramaView } from "./view";

export const metadata = { title: "Editar programa · SériePro" };

export default async function EditarProgramaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditarProgramaView id={id} />;
}
