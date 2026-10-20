"use client";

import { useActionState } from "react";
import { completeOnboarding } from "@/features/profile/actions";
import type { ProfileActionState } from "@/features/profile/schemas";
import { useRedirectOnSuccess } from "@/components/use-redirect";
import { Field, SelectField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function OnboardingForm() {
  const [state, action] = useActionState<ProfileActionState, FormData>(completeOnboarding, {});
  useRedirectOnSuccess(state.redirectTo);

  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="Nome" name="displayName" required errors={state.fieldErrors?.displayName} />

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Altura (cm)"
          name="heightCm"
          type="number"
          inputMode="numeric"
          min={80}
          max={260}
          required
          errors={state.fieldErrors?.heightCm}
        />
        <Field
          label="Peso atual (kg)"
          name="startingWeightKg"
          type="number"
          inputMode="decimal"
          step="0.1"
          min={20}
          max={400}
          required
          errors={state.fieldErrors?.startingWeightKg}
        />
      </div>

      <SelectField label="Objetivo principal" name="focus" defaultValue="hipertrofia" errors={state.fieldErrors?.focus}>
        <option value="hipertrofia">Ganhar massa muscular</option>
        <option value="forca">Ganhar força</option>
        <option value="emagrecimento">Perder gordura</option>
        <option value="recomposicao">Recomposição corporal</option>
        <option value="saude">Saúde e condicionamento</option>
      </SelectField>

      <SelectField label="Experiência" name="level" defaultValue="intermediario" errors={state.fieldErrors?.level}>
        <option value="iniciante">Iniciante, menos de 1 ano</option>
        <option value="intermediario">Intermediário, 1 a 3 anos</option>
        <option value="avancado">Avançado, mais de 3 anos</option>
      </SelectField>

      <SelectField
        label="Treinos por semana"
        name="weeklyTarget"
        defaultValue="5"
        errors={state.fieldErrors?.weeklyTarget}
      >
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <option key={n} value={n}>
            {n} {n === 1 ? "dia" : "dias"}
          </option>
        ))}
      </SelectField>

      {state.error && (
        <p role="alert" className="rounded border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
          {state.error}
        </p>
      )}

      <SubmitButton full>Concluir</SubmitButton>
    </form>
  );
}
