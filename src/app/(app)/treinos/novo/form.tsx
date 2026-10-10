"use client";

import { useActionState } from "react";
import { createRoutine } from "@/features/routines/actions";
import type { RoutineActionState } from "@/features/routines/schemas";
import { Field, SelectField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function NovoProgramaForm({ defaultDayCount }: { defaultDayCount: number }) {
  const [state, action] = useActionState<RoutineActionState, FormData>(createRoutine, {});

  return (
    <form action={action} className="space-y-4" noValidate>
      <Field
        label="Nome do programa"
        name="name"
        required
        maxLength={60}
        placeholder="Push Pull Legs"
        errors={state.fieldErrors?.name}
      />

      <SelectField
        label="Quantos dias"
        name="dayCount"
        defaultValue={String(defaultDayCount)}
        errors={state.fieldErrors?.dayCount}
      >
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <option key={n} value={n}>
            {n} {n === 1 ? "dia" : "dias"}
          </option>
        ))}
      </SelectField>
      <p className="-mt-2 text-xs text-faint">
        Os dias já nascem nomeados como Dia A, Dia B e assim por diante. Dá para renomear, adicionar e remover
        no editor.
      </p>

      <div className="space-y-1.5">
        <label htmlFor="description" className="block text-sm text-muted">
          Descrição
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={300}
          className="w-full rounded border border-line bg-surface p-3 text-[16px] placeholder:text-faint"
          placeholder="Opcional. Para que serve este bloco e quanto tempo pretende seguir."
        />
      </div>

      {state.error && (
        <p role="alert" className="rounded border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
          {state.error}
        </p>
      )}

      <SubmitButton full>Criar e montar</SubmitButton>
    </form>
  );
}
