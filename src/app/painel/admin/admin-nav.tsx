import { SideNav } from "@/components/side-nav";

const LINKS = [
  { href: "/painel/admin", label: "Visão geral", exact: true },
  { href: "/painel/admin/usuarios", label: "Usuários" },
  { href: "/painel/admin/viagens", label: "Viagens" },
  { href: "/painel/admin/selos", label: "Selos" },
  { href: "/painel/admin/atividade", label: "Atividade" },
];

export function AdminNav() {
  return <SideNav links={LINKS} label="Administração" />;
}
