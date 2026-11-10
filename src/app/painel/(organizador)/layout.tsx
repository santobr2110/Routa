import { SideNav, SideNavShell } from "@/components/side-nav";

const LINKS = [
  { href: "/painel", label: "Visão geral", exact: true },
  { href: "/painel/viagens", label: "Viagens" },
  { href: "/painel/participantes", label: "Participantes" },
  { href: "/painel/clube", label: "Página do clube" },
  { href: "/painel/perfil", label: "Perfil" },
];

/** Área do organizador: as viagens dele, os números e quem já foi com ele. */
export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  return (
    <SideNavShell title="Meu painel" nav={<SideNav links={LINKS} label="Meu painel" />}>
      {children}
    </SideNavShell>
  );
}
