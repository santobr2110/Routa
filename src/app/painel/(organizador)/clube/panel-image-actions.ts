"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PHOTOS_BUCKET } from "@/lib/trips";

/**
 * Grava a foto da capa do painel do organizador (vazio = volta à padrão da Routa).
 * Fica fora do formulário da página do clube: vale mesmo com a página desligada.
 */
export async function savePanelImage(path: string): Promise<{ ok: boolean }> {
  const { organizer } = await requireOrganizer();
  if (path && !(path.startsWith(`${organizer.id}/clube/`) && /^[\w/-]+\.jpg$/.test(path))) {
    return { ok: false };
  }
  const supabase = await createClient();
  const { data: before } = await supabase
    .from("organizers")
    .select("panel_image_path")
    .eq("id", organizer.id)
    .single();
  // O RLS só deixa o organizador alterar o próprio cadastro.
  const { error } = await supabase
    .from("organizers")
    .update({ panel_image_path: path || null })
    .eq("id", organizer.id);
  if (error) {
    console.error("savePanelImage", error);
    return { ok: false };
  }
  const old = before?.panel_image_path;
  if (old && old !== path) await supabase.storage.from(PHOTOS_BUCKET).remove([old]);
  revalidatePath("/painel");
  return { ok: true };
}
