import { signOut } from "@/features/auth/actions";
import { LogOut } from "lucide-react";

export function Topbar({ name }: { name: string }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-ink px-4 pt-[env(safe-area-inset-top,0px)] lg:px-8">
      <div className="flex h-14 items-center gap-3">
        <span className="font-condensed text-2xl font-bold tracking-wide lg:hidden">
          ALM<span className="text-brand">O</span>RE
        </span>
        <span className="hidden text-sm text-muted lg:inline">{name}</span>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className="flex min-h-11 items-center gap-2 rounded px-3 text-sm text-muted hover:bg-raised"
        >
          <LogOut className="size-4" aria-hidden />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </form>
    </header>
  );
}
