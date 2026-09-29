"use client";

import { useActionState } from "react";
import { signUp } from "@/features/auth/actions";
import type { ActionState } from "@/features/auth/schemas";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function SignUpForm() {
  const [state, action] = useActionState<ActionState, FormData>(signUp, {});

  if (state.success) {
    return (
      <p role="status" className="rounded border border-good/40 bg-good/10 px-3 py-3 text-sm text-good">
        {state.success}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="Nome" name="displayName" autoComplete="name" required errors={state.fieldErrors?.displayName} />
      <Field label="E-mail" name="email" type="email" autoComplete="email" required errors={state.fieldErrors?.email} />
      <Field
        label="Senha"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="Mínimo de 8 caracteres."
        errors={state.fieldErrors?.password}
      />

      {state.error && (
        <p role="alert" className="rounded border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
          {state.error}
        </p>
      )}

      <SubmitButton full>Criar conta</SubmitButton>
    </form>
  );
}
