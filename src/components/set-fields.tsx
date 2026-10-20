"use client";

import { kg } from "@/core/utils/format";
import { NumberStepper } from "@/components/ui/number-stepper";

/**
 * Valores de uma série enquanto o usuário edita. Serve a execução (Fase 4)
 * e a correção no histórico (Fase 6); por isso mora em `components`, com
 * forma própria, sem importar de nenhuma feature.
 */
export type SetDraft = {
  /** 0 em exercício de peso corporal significa sem carga adicional. */
  peso: number;
  reps: number;
  rir: number;
  usaRir: boolean;
  aquecimento: boolean;
};

/** "80 kg", "+10 kg" (carga adicional) ou "Peso corporal". */
export function weightLabel(isBodyweight: boolean, peso: number | null): string {
  if (peso === null || (isBodyweight && peso === 0)) return "Peso corporal";
  // `kg` espera o formato do numeric ("80.00"); com o número 80 ele
  // cortaria o zero da dezena. Por isso o toFixed.
  const texto = kg(peso.toFixed(2));
  return isBodyweight ? `+${texto} kg` : `${texto} kg`;
}

/** Do rascunho para o que vai ao banco: 0 em peso corporal vira nulo. */
export function draftWeight(isBodyweight: boolean, d: SetDraft): number | null {
  return isBodyweight && d.peso === 0 ? null : d.peso;
}

export function SetFields({
  isBodyweight,
  loadStepKg,
  valor,
  onChange,
}: {
  isBodyweight: boolean;
  loadStepKg: number;
  valor: SetDraft;
  onChange: (v: SetDraft) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <NumberStepper
          label={isBodyweight ? "Carga adicional" : "Carga"}
          name="weightKg"
          value={valor.peso}
          onChange={(peso) => onChange({ ...valor, peso })}
          min={0}
          max={999.99}
          step={loadStepKg}
          unit="kg"
          hint={isBodyweight && valor.peso === 0 ? "Só o corpo" : undefined}
        />
        <NumberStepper
          label="Repetições"
          name="reps"
          value={valor.reps}
          onChange={(reps) => onChange({ ...valor, reps })}
          min={0}
          max={100}
        />
      </div>

      <div className="grid grid-cols-2 items-end gap-3">
        {valor.usaRir ? (
          <NumberStepper
            label="RIR"
            name="rir"
            value={valor.rir}
            onChange={(rir) => onChange({ ...valor, rir })}
            min={0}
            max={10}
          />
        ) : (
          <button
            type="button"
            onClick={() => onChange({ ...valor, usaRir: true })}
            className="min-h-11 rounded border border-dashed border-line px-3 text-sm text-muted hover:bg-raised"
          >
            Anotar RIR
          </button>
        )}

        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded border border-line bg-surface px-3 text-sm">
          <input
            type="checkbox"
            checked={valor.aquecimento}
            onChange={(e) => onChange({ ...valor, aquecimento: e.target.checked })}
            className="size-4 accent-[var(--color-brand)]"
          />
          Aquecimento
        </label>
      </div>
    </div>
  );
}
