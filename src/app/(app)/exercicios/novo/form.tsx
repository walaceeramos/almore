"use client";

import { useActionState, useState } from "react";
import { createCustomExercise } from "@/features/exercises/actions";
import type { ExerciseActionState } from "@/features/exercises/schemas";
import { PATTERN_LABEL, EQUIPMENT_LABEL } from "@/features/exercises/labels";
import { useRedirectOnSuccess } from "@/components/use-redirect";
import { Field, SelectField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

type Muscle = { id: string; name: string; region: string };

export function NovoExercicioForm({ muscles }: { muscles: Muscle[] }) {
  const [state, action] = useActionState<ExerciseActionState, FormData>(createCustomExercise, {});
  useRedirectOnSuccess(state.redirectTo);
  const [primario, setPrimario] = useState(muscles[0]?.id ?? "");

  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="Nome" name="name" required maxLength={80} errors={state.fieldErrors?.name} />

      <SelectField
        label="Músculo principal"
        name="primaryMuscle"
        value={primario}
        onChange={(e) => setPrimario(e.target.value)}
        errors={state.fieldErrors?.primaryMuscle}
      >
        {muscles.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </SelectField>

      <fieldset className="space-y-2">
        <legend className="text-sm text-muted">Músculos secundários</legend>
        <p className="text-xs text-faint">
          Contam meia série no volume semanal. Deixe vazio se o exercício for isolador.
        </p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {muscles
            .filter((m) => m.id !== primario)
            .map((m) => (
              <label key={m.id} className="flex min-h-10 items-center gap-2 text-sm">
                <input type="checkbox" name="secondaryMuscles" value={m.id} className="size-4 accent-brand" />
                <span className="truncate">{m.name}</span>
              </label>
            ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Padrão de movimento" name="pattern" defaultValue="isolador" errors={state.fieldErrors?.pattern}>
          {Object.entries(PATTERN_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </SelectField>

        <SelectField label="Equipamento" name="equipment" defaultValue="maquina" errors={state.fieldErrors?.equipment}>
          {Object.entries(EQUIPMENT_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Descanso (segundos)"
          name="defaultRestSeconds"
          type="number"
          inputMode="numeric"
          defaultValue={120}
          min={15}
          max={600}
          errors={state.fieldErrors?.defaultRestSeconds}
        />
        <Field
          label="Incremento (kg)"
          name="loadStepKg"
          type="number"
          inputMode="decimal"
          step="0.25"
          defaultValue={2.5}
          min={0.25}
          max={25}
          hint="Halter 2, máquina 2,5 a 5."
          errors={state.fieldErrors?.loadStepKg}
        />
      </div>

      <label className="flex min-h-11 items-center gap-2.5 text-sm">
        <input type="checkbox" name="isUnilateral" className="size-4 accent-brand" />
        Unilateral, um lado por vez
      </label>

      <div className="space-y-1.5">
        <label htmlFor="cue" className="block text-sm text-muted">
          Observação técnica
        </label>
        <textarea
          id="cue"
          name="cue"
          rows={3}
          maxLength={400}
          className="w-full rounded border border-line bg-surface p-3 text-[16px] placeholder:text-faint"
          placeholder="Opcional. O que lembrar na hora de executar."
        />
      </div>

      {state.error && (
        <p role="alert" className="rounded border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
          {state.error}
        </p>
      )}

      <SubmitButton full>Salvar exercício</SubmitButton>
    </form>
  );
}
