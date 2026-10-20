import { EQUIPMENT_LABEL } from "./labels";
import { listExercises } from "./queries";

/**
 * Lista pronta para o `ExercisePicker` de `components`. A forma é a mesma
 * de `PickableExercise`, declarada aqui de novo para a feature não
 * depender de componente de interface.
 */
export async function listPickableExercises(): Promise<
  { id: string; name: string; muscleName: string | null; equipmentLabel: string; isOwn: boolean }[]
> {
  return (await listExercises({})).map((e) => ({
    id: e.id,
    name: e.name,
    muscleName: e.muscles.find((m) => m.role === "primario")?.name ?? null,
    equipmentLabel: EQUIPMENT_LABEL[e.equipment] ?? e.equipment,
    isOwn: e.isCustom,
  }));
}
