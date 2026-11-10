// Aparência do site (Site Settings, migration 0015): imagem do login, imagem do painel e
// cor principal. Fica num lugar só para o admin ajustar a "cara" da Routa.

import { createClient as createSupabase } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";
import { photoUrl } from "@/lib/trips";
import type { Database } from "@/types/database";

export const SITE_SETTINGS_TAG = "site-settings";

export type SiteSettings = {
  login_image_path: string | null;
  panel_image_path: string | null;
  brand_color: string | null;
};

const EMPTY: SiteSettings = { login_image_path: null, panel_image_path: null, brand_color: null };

/**
 * Lê as configurações com cache (sem cookies, igual para todo mundo). O cache é renovado na
 * hora quando o admin salva (updateTag) e, por segurança, a cada 10 minutos.
 * Se o banco falhar (ou a 0015 ainda não foi aplicada), o site segue com o visual padrão.
 */
export const getSiteSettings = unstable_cache(
  async (): Promise<SiteSettings> => {
    const supabase = createSupabase<Database>(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.rpc("get_site_settings");
    if (error || !data) {
      if (error) console.error("site-settings:", error.message);
      return EMPTY;
    }
    return { ...EMPTY, ...(data as unknown as Partial<SiteSettings>) };
  },
  ["site-settings"],
  { tags: [SITE_SETTINGS_TAG], revalidate: 600 },
);

/** URL pública de uma imagem do site/organizador, ou undefined (usa a foto padrão). */
export function imageUrl(path: string | null | undefined): string | undefined {
  return path ? photoUrl(path) : undefined;
}
