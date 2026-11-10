"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SideNavLink = { href: string; label: string; exact?: boolean };

/** Abas no celular; menu lateral no computador. */
export function SideNav({ links, label }: { links: SideNavLink[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav
      className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0 lg:flex-col lg:border-0"
      aria-label={label}
    >
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className="-mb-px inline-flex min-h-10 shrink-0 items-center border-b-2 border-transparent px-3 text-sm text-ink-soft hover:text-ink aria-[current=page]:border-brand aria-[current=page]:font-medium aria-[current=page]:text-ink lg:mb-0 lg:min-h-9 lg:rounded-md lg:border-0 lg:aria-[current=page]:bg-surface-muted"
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Página com o menu lateral (desktop) ou abas (celular) acima do conteúdo. */
export function SideNavShell({
  title,
  nav,
  children,
}: {
  title: string;
  nav: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="gap-8 lg:grid lg:grid-cols-[180px_minmax(0,1fr)]">
      <aside className="mb-6 lg:mb-0">
        <div className="space-y-3 lg:sticky lg:top-6">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">{title}</p>
          {nav}
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
