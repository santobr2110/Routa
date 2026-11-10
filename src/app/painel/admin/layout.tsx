import { requireAdmin } from "@/lib/admin";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({ children }: LayoutProps<"/painel/admin">) {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">Administração</p>
        <AdminNav />
      </div>
      {children}
    </div>
  );
}
