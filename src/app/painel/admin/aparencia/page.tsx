import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import type { SiteSettings } from "@/lib/site-settings";
import { AppearanceForm } from "./appearance-form";

export const metadata: Metadata = {
  title: "Admin · Aparência",
  robots: { index: false },
};

export default async function AparenciaPage() {
  const { supabase } = await requireAdmin();
  // Leitura direta (sem cache): o admin vê sempre o que está gravado.
  const { data, error } = await supabase.rpc("get_site_settings");
  const settings = (data ?? {}) as Partial<SiteSettings>;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="space-y-1">
        <h1 className="page-title">Aparência</h1>
        <p className="text-sm text-muted">
          A cara da Routa: a cor principal e as fotos do login e do painel. Clubes com página
          ligada continuam com a cor e a foto deles.
        </p>
      </div>
      {error ? (
        <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn" role="alert">
          Não deu para ler a aparência. A migration 0015 já foi aplicada no Supabase?
        </p>
      ) : (
        <AppearanceForm
          initial={{
            login_image_path: settings.login_image_path ?? "",
            panel_image_path: settings.panel_image_path ?? "",
            brand_color: settings.brand_color ?? "",
          }}
        />
      )}
    </div>
  );
}
