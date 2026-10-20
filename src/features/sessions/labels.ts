import { EPLEY_RELIABLE_MAX_REPS } from "@/core/domain/records";
import { kg } from "@/core/utils/format";
import type { PersonalRecordView, RecordKind } from "./queries";

export const RECORD_LABEL: Record<RecordKind, string> = {
  carga_maxima: "Maior carga",
  melhor_serie: "Melhor série (1RM estimado)",
  volume_serie: "Volume numa série",
  volume_sessao: "Volume numa sessão",
};

/** Ordem de leitura no detalhe do exercício. */
export const RECORD_ORDER: RecordKind[] = ["carga_maxima", "melhor_serie", "volume_serie", "volume_sessao"];

/** `kg` espera o formato do numeric; com número inteiro cortaria o zero. */
function peso(n: number): string {
  return kg(n.toFixed(2));
}

const MILHAR = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/**
 * O valor do recorde como o usuário lê. 1RM acima de 12 repetições é
 * marcado como estimativa fraca: a fórmula de Epley perde precisão ali.
 */
export function recordValue(r: Pick<PersonalRecordView, "kind" | "value" | "weightKg" | "reps">): string {
  switch (r.kind) {
    case "carga_maxima":
      return `${peso(r.value)} kg × ${r.reps}`;
    case "melhor_serie":
      return r.reps > EPLEY_RELIABLE_MAX_REPS ? `≈ ${peso(r.value)} kg (estimativa fraca)` : `${peso(r.value)} kg`;
    case "volume_serie":
      return `${peso(r.weightKg)} kg × ${r.reps}`;
    case "volume_sessao":
      return `${MILHAR.format(r.value)} kg`;
  }
}
