import * as React from "react";
import { cn } from "@/core/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  full?: boolean;
};

const styles: Record<Variant, string> = {
  primary: "bg-brand text-ink hover:brightness-110 font-semibold",
  secondary: "border border-line bg-surface hover:bg-raised",
  ghost: "hover:bg-raised",
  danger: "border border-bad/40 text-bad hover:bg-bad/10",
};

export function Button({ className, variant = "primary", full, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 text-[15px]",
        "transition-[filter,background-color] disabled:cursor-not-allowed disabled:opacity-50",
        styles[variant],
        full && "w-full",
        className,
      )}
      {...props}
    />
  );
}
