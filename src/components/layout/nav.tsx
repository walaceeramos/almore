"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { primaryNav, secondaryNav, moreIcon as MoreIcon } from "@/config/nav";
import { cn } from "@/core/utils/cn";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/** Barra inferior, apenas no celular. Some a partir de lg. */
export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const moreActive = secondaryNav.some((i) => isActive(pathname, i.href));

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-ink/70 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {open && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl border-t border-line bg-raised p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] lg:hidden"
          role="dialog"
          aria-label="Mais opções"
        >
          {secondaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex min-h-12 items-center gap-3 rounded px-3 text-[15px] hover:bg-surface"
            >
              <item.icon className="size-5 text-muted" aria-hidden />
              {item.label}
              {item.soon && <span className="ml-auto text-xs text-faint">em breve</span>}
            </Link>
          ))}
        </div>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink pb-[env(safe-area-inset-bottom,0px)] lg:hidden"
        aria-label="Navegação principal"
      >
        <ul className="mx-auto flex max-w-lg">
          {primaryNav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px]",
                    active ? "text-brand" : "text-muted",
                  )}
                >
                  <item.icon className="size-5" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className={cn(
                "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px]",
                moreActive || open ? "text-brand" : "text-muted",
              )}
            >
              <MoreIcon className="size-5" aria-hidden />
              Mais
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}

/** Barra lateral fixa, apenas a partir de lg. */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed inset-y-0 left-0 hidden w-60 border-r border-line bg-surface px-3 py-5 lg:block"
      aria-label="Navegação principal"
    >
      <p className="px-3 font-condensed text-2xl font-bold tracking-wide">
        ALM<span className="text-brand">O</span>RE
      </p>
      <nav className="mt-6 space-y-0.5">
        {[...primaryNav, ...secondaryNav].map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded px-3 text-[15px]",
                active ? "bg-raised text-brand" : "text-muted hover:bg-raised hover:text-body",
              )}
            >
              <item.icon className="size-5" aria-hidden />
              {item.label}
              {item.soon && <span className="ml-auto text-[10px] text-faint">em breve</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
