import { requireAdmin } from "@/lib/admin";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({
  children,
}: LayoutProps<"/painel/admin">) {
  await requireAdmin();
  return (
    <div className="gap-8 lg:grid lg:grid-cols-[180px_minmax(0,1fr)]">
      <aside className="mb-6 lg:mb-0">
        <div className="space-y-3 lg:sticky lg:top-6">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            Administração
          </p>
          <AdminNav />
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
