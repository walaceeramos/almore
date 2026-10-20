import { ExercicioView } from "./view";

export const metadata = { title: "Exercício · Almore" };

export default async function ExercicioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExercicioView id={decodeURIComponent(id)} />;
}
