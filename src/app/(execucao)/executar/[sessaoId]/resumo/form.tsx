"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { finishSession } from "@/features/sessions/actions";
import type { SessionActionState } from "@/features/sessions/schemas";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/core/utils/cn";

const ESFORCO = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function ConcluirForm({ sessionId }: { sessionId: string }) {
  const [state, action] = useActionState<SessionActionState, FormData>(finishSession, {});
  const [esforco, setEsforco] = useState<number | null>(null);

  return (
    <form
      action={action}
      onSubmit={() => {
        // O descanso pendente não interessa mais depois de concluir.
        try {
          window.localStorage.removeItem(`almore:descanso:${sessionId}`);
        } catch {
          // Armazenamento bloqueado: nada a limpar.
        }
      }}
      className="space-y-4"
      noValidate
    >
      <input type="hidden" name="id" value={sessionId} />
      <input type="hidden" name="perceivedEffort" value={esforco ?? ""} />

      <fieldset className="space-y-1.5">
        <legend className="text-sm text-muted">Esforço percebido (opcional)</legend>
        <div className="grid grid-cols-5 gap-1.5">
          {ESFORCO.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={esforco === n}
              onClick={() => setEsforco(esforco === n ? null : n)}
              className={cn(
                "min-h-11 rounded border font-condensed text-lg tabular-nums",
                esforco === n ? "border-brand bg-brand/15 text-brand" : "border-line bg-surface text-muted hover:bg-raised",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-xs text-faint">1 = muito leve · 10 = esforço máximo. Toque de novo para limpar.</p>
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="notes" className="block text-sm text-muted">
          Observação (opcional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={500}
          placeholder="Dormi mal, ombro incomodou no supino..."
          className="w-full rounded border border-line bg-surface px-3 py-2 text-[16px] placeholder:text-faint"
        />
        {state.fieldErrors?.notes && <p className="text-xs text-bad">{state.fieldErrors.notes[0]}</p>}
      </div>

      {state.error && (
        <p role="alert" className="rounded border border-bad/40 bg-bad/10 px-3 py-2 text-[13px] text-bad">
          {state.error}
        </p>
      )}

      <SubmitButton full className="min-h-14 text-base">
        <Check className="size-5" aria-hidden />
        Concluir treino
      </SubmitButton>
    </form>
  );
}
