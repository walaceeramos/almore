export const PATTERN_LABEL: Record<string, string> = {
  empurrar_horizontal: "Empurrar horizontal",
  empurrar_vertical: "Empurrar vertical",
  puxar_horizontal: "Puxar horizontal",
  puxar_vertical: "Puxar vertical",
  agachamento: "Agachamento",
  dobradica_quadril: "Dobradiça de quadril",
  extensao_joelho: "Extensão de joelho",
  flexao_joelho: "Flexão de joelho",
  isolador: "Isolador",
  core: "Core",
  carregamento: "Carregamento",
};

export const EQUIPMENT_LABEL: Record<string, string> = {
  barra: "Barra",
  halter: "Halteres",
  maquina: "Máquina",
  cabo: "Cabo",
  peso_corporal: "Peso corporal",
  kettlebell: "Kettlebell",
  elastico: "Elástico",
  outro: "Outro",
};

export const PATTERNS = Object.keys(PATTERN_LABEL);
export const EQUIPMENTS = Object.keys(EQUIPMENT_LABEL);

export function restLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const min = seconds / 60;
  return Number.isInteger(min) ? `${min} min` : `${Math.floor(min)} min ${seconds % 60} s`;
}
