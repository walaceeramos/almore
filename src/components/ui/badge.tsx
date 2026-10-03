import { cn } from "@/core/utils/cn";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "brand" | "muted";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] leading-4",
        tone === "brand" && "border-brand/40 bg-brand/10 text-brand",
        tone === "neutral" && "border-line bg-raised text-muted",
        tone === "muted" && "border-transparent text-faint",
        className,
      )}
    >
      {children}
    </span>
  );
}
