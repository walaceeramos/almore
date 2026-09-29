import * as React from "react";
import { cn } from "@/core/utils/cn";

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  errors?: string[];
};

export function Field({ label, hint, errors, className, id, ...props }: FieldProps) {
  const inputId = id ?? props.name;
  const errorId = errors?.length ? `${inputId}-erro` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm text-muted">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={errorId}
        className={cn(
          "min-h-11 w-full rounded border border-line bg-surface px-3 text-[16px]",
          "placeholder:text-faint",
          errors?.length && "border-bad",
          className,
        )}
        {...props}
      />
      {hint && !errors?.length && <p className="text-xs text-faint">{hint}</p>}
      {errors?.length ? (
        <p id={errorId} className="text-xs text-bad">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  errors?: string[];
};

export function SelectField({ label, errors, className, id, children, ...props }: SelectProps) {
  const selectId = id ?? props.name;
  return (
    <div className="space-y-1.5">
      <label htmlFor={selectId} className="block text-sm text-muted">
        {label}
      </label>
      <select
        id={selectId}
        className={cn(
          "min-h-11 w-full appearance-none rounded border border-line bg-surface px-3 text-[16px]",
          errors?.length && "border-bad",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {errors?.length ? <p className="text-xs text-bad">{errors[0]}</p> : null}
    </div>
  );
}
