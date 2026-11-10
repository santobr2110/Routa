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

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Administração">
      {LINKS.map((link) => {
        const active =
          link.href === "/painel/admin" ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className="inline-flex min-h-12 shrink-0 items-center rounded-full border-2 border-line-strong px-4 font-semibold aria-[current=page]:border-brand aria-[current=page]:bg-brand-soft"
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
