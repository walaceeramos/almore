import * as React from "react";
import Link from "next/link";
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

/**
 * Mesma aparência do Button, mas navega. Existe para não aninhar <button>
 * dentro de <a>, que é HTML inválido e confunde leitor de tela.
 */
export function ButtonLink({
  href,
  className,
  variant = "primary",
  full,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "className"> & {
  className?: string;
  variant?: Variant;
  full?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 text-[15px]",
        "transition-[filter,background-color]",
        styles[variant],
        full && "w-full",
        className,
      )}
      {...props}
    />
  );
}
