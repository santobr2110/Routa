import { SideNavShell } from "@/components/side-nav";
import { requireAdmin } from "@/lib/admin";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({ children }: LayoutProps<"/painel/admin">) {
  await requireAdmin();
  return (
    <SideNavShell title="Administração" nav={<AdminNav />}>
      {children}
    </SideNavShell>
  );
}
