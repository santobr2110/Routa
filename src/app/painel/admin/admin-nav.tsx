"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/painel/admin", label: "Visão geral" },
  { href: "/painel/admin/usuarios", label: "Usuários" },
  { href: "/painel/admin/viagens", label: "Viagens" },
  { href: "/painel/admin/selos", label: "Selos" },
  { href: "/painel/admin/atividade", label: "Atividade" },
];

/** Abas no celular; menu lateral no computador. */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav
      className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0 lg:flex-col lg:border-0"
      aria-label="Administração"
    >
      {LINKS.map((link) => {
        const active =
          link.href === "/painel/admin"
            ? pathname === link.href
            : pathname.startsWith(link.href);
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
