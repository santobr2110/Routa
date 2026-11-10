"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { ROUTA_COLOR, isHexColor } from "@/lib/club-colors";
import { SITE_SETTINGS_TAG } from "@/lib/site-settings";
import { PHOTOS_BUCKET } from "@/lib/trips";

export type AppearanceState = { saved?: boolean; error?: string };

const SITE_IMAGE = /^site\/[A-Za-z0-9._-]{1,120}$/;

/** Salva a aparência do site. O banco confere de novo se é admin e registra na auditoria. */
export async function saveAppearance(
  _prev: AppearanceState,
  formData: FormData,
): Promise<AppearanceState> {
  const { supabase } = await requireAdmin();
  const login = String(formData.get("login_image_path") ?? "");
  const panel = String(formData.get("panel_image_path") ?? "");
  // O laranja Routa é o padrão do globals.css: guardar vazio mantém os tons originais.
  let color = String(formData.get("brand_color") ?? "").toLowerCase();
  if (color === ROUTA_COLOR) color = "";

  if ((login && !SITE_IMAGE.test(login)) || (panel && !SITE_IMAGE.test(panel))) {
    return { error: "Não deu para usar essa imagem. Envia de novo." };
  }
  if (color && !isHexColor(color)) return { error: "Escolhe uma cor válida." };

  const { data, error } = await supabase.rpc("admin_update_site_settings", {
    p_login_image_path: login,
    p_panel_image_path: panel,
    p_brand_color: color,
  });
  if (error) {
    console.error("admin_update_site_settings", error);
    return { error: "Não deu para salvar agora. Tenta de novo." };
  }

  // Apaga do Storage as imagens que deixaram de ser usadas.
  const unused = ((data as { unused?: string[] } | null)?.unused ?? []).filter((p) =>
    SITE_IMAGE.test(p),
  );
  if (unused.length > 0) await supabase.storage.from(PHOTOS_BUCKET).remove(unused);

  // O site inteiro passa a usar o visual novo na próxima visita.
  updateTag(SITE_SETTINGS_TAG);
  revalidatePath("/", "layout");
  return { saved: true };
}
