"use client";

import { useId } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/core/utils/cn";

type Props = {
  label: string;
  name: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  /** Quanto cada toque em − ou + move. Aceita fração, como 0,25 kg. */
  step?: number;
  /** Sufixo mostrado junto do número, como "kg" ou "s". */
  unit?: string;
  hint?: string;
  errors?: string[];
  className?: string;
};

/** Evita 2.5000000000000004 ao somar frações como 0,25. */
function arredonda(n: number, step: number): number {
  const casas = (String(step).split(".")[1] ?? "").length;
  return Number(n.toFixed(casas));
}

/**
 * Campo numérico com botões grandes de − e +.
 *
 * Existe porque o app é usado com uma mão, de pé, com a mão suada, em 60 a
 * 180 segundos de descanso. Campo de número padrão nesse contexto é a maior
 * fonte de erro de digitação do app, e um erro aqui vira dado errado no
 * histórico, que é a matéria-prima de toda a progressão.
 *
 * O campo de texto continua editável para quem prefere digitar: os botões
 * são o caminho rápido, não o único.
 */
export function NumberStepper({
  label,
  name,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  hint,
  errors,
  className,
}: Props) {
  const id = useId();
  const errorId = errors?.length ? `${id}-erro` : undefined;

  function mover(delta: number) {
    const bruto = arredonda(value + delta, step);
    onChange(Math.min(max, Math.max(min, bruto)));
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm text-muted">
        {label}
      </label>

      <div className="flex items-stretch gap-1.5">
        <button
          type="button"
          onClick={() => mover(-step)}
          disabled={value <= min}
          aria-label={`Diminuir ${label}`}
          className="flex size-11 shrink-0 items-center justify-center rounded border border-line bg-surface text-muted transition-colors hover:bg-raised disabled:opacity-40"
        >
          <Minus className="size-4" aria-hidden />
        </button>

        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            name={name}
            type="number"
            inputMode="decimal"
            value={value}
            min={min}
            max={max}
            step={step}
            aria-invalid={errors?.length ? true : undefined}
            aria-describedby={errorId}
            onChange={(e) => {
              const n = Number(e.target.value);
              // Deixa o campo livre enquanto digita; o Zod da action decide.
              if (Number.isFinite(n)) onChange(n);
            }}
            onBlur={(e) => {
              const n = Number(e.target.value);
              // Só prende aos limites ao sair, para não brigar com a digitação.
              onChange(Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min);
            }}
            className={cn(
              "min-h-11 w-full rounded border border-line bg-surface px-2 text-center text-[16px] tabular-nums",
              "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
              unit && "pr-7",
              errors?.length && "border-bad",
            )}
          />
          {unit && (
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-faint">
              {unit}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => mover(step)}
          disabled={value >= max}
          aria-label={`Aumentar ${label}`}
          className="flex size-11 shrink-0 items-center justify-center rounded border border-line bg-surface text-muted transition-colors hover:bg-raised disabled:opacity-40"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>

      {hint && !errors?.length && <p className="text-xs text-faint">{hint}</p>}
      {errors?.length ? (
        <p id={errorId} className="text-xs text-bad">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}
