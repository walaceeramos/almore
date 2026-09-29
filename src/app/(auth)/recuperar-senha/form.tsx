"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/features/auth/actions";
import type { ActionState } from "@/features/auth/schemas";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function ResetForm() {
  const [state, action] = useActionState<ActionState, FormData>(requestPasswordReset, {});

  if (state.success) {
    return (
      <p role="status" className="rounded border border-good/40 bg-good/10 px-3 py-3 text-sm text-good">
        {state.success}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="E-mail" name="email" type="email" autoComplete="email" required errors={state.fieldErrors?.email} />
      {state.error && (
        <p role="alert" className="rounded border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
          {state.error}
        </p>
      )}
      <SubmitButton full>Enviar link</SubmitButton>
    </form>
  );
}
