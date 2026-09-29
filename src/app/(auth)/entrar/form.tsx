"use client";

import { useActionState } from "react";
import { signIn } from "@/features/auth/actions";
import type { ActionState } from "@/features/auth/schemas";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function SignInForm({ proximo }: { proximo?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(signIn, {});

  return (
    <form action={action} className="space-y-4" noValidate>
      {proximo && <input type="hidden" name="proximo" value={proximo} />}

      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        required
        errors={state.fieldErrors?.email}
      />
      <Field
        label="Senha"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        errors={state.fieldErrors?.password}
      />

      {state.error && (
        <p role="alert" className="rounded border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
          {state.error}
        </p>
      )}

      <SubmitButton full>Entrar</SubmitButton>
    </form>
  );
}
