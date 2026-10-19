"use client";

import { useActionState } from "react";
import { Play } from "lucide-react";
import { startSession } from "../actions";
import type { SessionActionState } from "../schemas";
import { SelectField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

type Props = {
  /** Dias que podem ser treinados, na ordem do programa. */
  days: { id: string; name: string }[];
  /** O próximo da sequência. O usuário pode trocar. */
  defaultDayId: string;
  /** Rótulo do botão; o dashboard usa um texto mais direto. */
  label?: string;
};

/**
 * Inicia um treino a partir de um dia do programa. Com um dia só, não há o
 * que escolher e o seletor some.
 */
export function StartSessionForm({ days, defaultDayId, label = "Iniciar treino" }: Props) {
  const [state, action] = useActionState<SessionActionState, FormData>(startSession, {});

  return (
    <form action={action} className="space-y-3">
      {days.length > 1 ? (
        <SelectField label="Dia" name="routineDayId" defaultValue={defaultDayId}>
          {days.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </SelectField>
      ) : (
        <input type="hidden" name="routineDayId" value={defaultDayId} />
      )}

      {state.error && (
        <p role="alert" className="rounded border border-bad/40 bg-bad/10 px-3 py-2 text-[13px] text-bad">
          {state.error}
        </p>
      )}

      <SubmitButton full>
        <Play className="size-4" aria-hidden />
        {label}
      </SubmitButton>
    </form>
  );
}
