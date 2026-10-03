"use client";

import { useActionState } from "react";
import { updatePassword } from "@/features/auth/actions";
import type { ActionState } from "@/features/auth/schemas";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function NovaSenhaForm() {
  const [state, action] = useActionState<ActionState, FormData>(updatePassword, {});

  return (
    <form action={action} className="space-y-4" noValidate>
      <Field
        label="Nova senha"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="Pelo menos 8 caracteres."
        errors={state.fieldErrors?.password}
      />
      <Field
        label="Repita a nova senha"
        name="confirmation"
        type="password"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.confirmation}
      />

      {state.error && (
        <p role="alert" className="rounded border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
          {state.error}
        </p>
      )}

      <SubmitButton full>Salvar senha</SubmitButton>
    </form>
  );
}
