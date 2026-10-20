/** Sem login, não há "Sair": o nome identifica de quem é o aparelho. */
export function Topbar({ name }: { name: string }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-ink px-4 pt-[env(safe-area-inset-top,0px)] lg:px-8">
      <div className="flex h-14 items-center gap-3">
        <span className="font-condensed text-2xl font-bold tracking-wide lg:hidden">
          ALM<span className="text-brand">O</span>RE
        </span>
        <span className="hidden text-sm text-muted lg:inline">{name}</span>
      </div>
      <span className="truncate text-sm text-muted lg:hidden">{name}</span>
    </header>
  );
}
