"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganizer } from "@/lib/auth";
import { isHexColor } from "@/lib/club-colors";
import { createClient } from "@/lib/supabase/server";
import { CLUB_FIELDS, type ClubField, type ClubState, type ClubValues } from "@/lib/club";
import { PHOTOS_BUCKET } from "@/lib/trips";

const ERRORS: Record<ClubField, string> = {
  page_enabled: "Valor inválido.",
  page_slug:
    "Use de 3 a 40 letras minúsculas, números ou hífen (sem acento e sem espaço), ex.: moto-clube-x.",
  page_name: "Coloca o nome do clube (de 2 a 60 letras).",
  page_bio: "A descrição pode ter até 800 caracteres.",
  page_city: "A cidade pode ter até 60 caracteres.",
  page_instagram: "Coloca só o @ do Instagram, ex.: motoclubex.",
  page_show_whatsapp: "Valor inválido.",
  page_color: "Escolhe uma cor.",
  page_logo_path: "Não deu para usar esse logo. Envia de novo.",
  page_cover_path: "Não deu para usar essa capa. Envia de novo.",
};

/** "@moto.clube", "instagram.com/moto.clube/" ou "moto.clube" → "moto.clube". */
function instagramHandle(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?].*$/, "");
}

export async function saveClubPage(_prev: ClubState, formData: FormData): Promise<ClubState> {
  const { organizer } = await requireOrganizer();
  const values = Object.fromEntries(
    CLUB_FIELDS.map((f) => [f, String(formData.get(f) ?? "")]),
  ) as ClubValues;
  const errors: ClubState["errors"] = {};
  // "publish": liga e salva · "save": salva com a página no ar · "disable": só tira do ar.
  const intent = String(formData.get("intent") ?? "save");

  if (intent === "disable") {
    const supabase = await createClient();
    const { data: current, error } = await supabase
      .from("organizers")
      .update({ page_enabled: false })
      .eq("id", organizer.id)
      .select("page_slug")
      .single();
    if (error) {
      console.error("saveClubPage disable", error);
      return { values, errors: { form: "Não deu para tirar do ar agora. Tenta de novo." } };
    }
    revalidatePath("/painel/clube");
    if (current?.page_slug) revalidatePath(`/c/${current.page_slug}`);
    // Nada é apagado: os dados ficam guardados para quando ligar de novo.
    return { values: { ...values, page_enabled: "" }, saved: true, notice: "off" };
  }

  // Salvar sempre deixa a página no ar (com ela desligada, o formulário fica travado).
  const wasLive = values.page_enabled === "on";
  const slug = values.page_slug.trim().toLowerCase();
  const name = values.page_name.trim();
  const bio = values.page_bio.trim();
  const city = values.page_city.trim();
  const instagram = instagramHandle(values.page_instagram);
  const color = values.page_color.trim().toLowerCase();
  // Imagens: só caminhos na pasta do próprio organizador.
  const ownImage = (path: string) =>
    path === "" || (path.startsWith(`${organizer.id}/clube/`) && /^[\w/-]+\.jpg$/.test(path));

  if (slug && !/^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/.test(slug)) errors.page_slug = ERRORS.page_slug;
  if (slug.includes("--")) errors.page_slug = ERRORS.page_slug;
  if (!slug) errors.page_slug = "Escolhe o endereço da página para ligar.";
  if (name && !z.string().min(2).max(60).safeParse(name).success) errors.page_name = ERRORS.page_name;
  if (!name) errors.page_name = ERRORS.page_name;
  if (bio.length > 800) errors.page_bio = ERRORS.page_bio;
  if (city.length > 60) errors.page_city = ERRORS.page_city;
  if (instagram && !/^[A-Za-z0-9._]{1,30}$/.test(instagram)) {
    errors.page_instagram = ERRORS.page_instagram;
  }
  if (color && !isHexColor(color)) errors.page_color = ERRORS.page_color;
  if (!ownImage(values.page_logo_path)) errors.page_logo_path = ERRORS.page_logo_path;
  if (!ownImage(values.page_cover_path)) errors.page_cover_path = ERRORS.page_cover_path;
  if (Object.keys(errors).length > 0) return { values, errors };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("organizers")
    .select("page_logo_path, page_cover_path")
    .eq("id", organizer.id)
    .single();

  // O RLS só deixa o organizador alterar o próprio cadastro.
  const { error } = await supabase
    .from("organizers")
    .update({
      page_enabled: true,
      page_slug: slug || null,
      page_name: name || null,
      page_bio: bio || null,
      page_city: city || null,
      page_instagram: instagram || null,
      page_show_whatsapp: values.page_show_whatsapp === "on",
      page_color: color || null,
      page_logo_path: values.page_logo_path || null,
      page_cover_path: values.page_cover_path || null,
    })
    .eq("id", organizer.id);

  if (error) {
    if (error.code === "23505") {
      return { values, errors: { page_slug: "Esse endereço já está em uso. Tenta outro." } };
    }
    if (error.message.includes("reserved_slug")) {
      return { values, errors: { page_slug: "Esse endereço é reservado. Tenta outro." } };
    }
    console.error("saveClubPage", error);
    return { values, errors: { form: "Não deu para salvar agora. Tenta de novo." } };
  }

  // Apaga as imagens antigas que foram trocadas ou removidas.
  const old = [before?.page_logo_path, before?.page_cover_path].filter(
    (p): p is string =>
      !!p && p !== values.page_logo_path && p !== values.page_cover_path,
  );
  if (old.length > 0) await supabase.storage.from(PHOTOS_BUCKET).remove(old);

  revalidatePath("/painel/clube");
  if (slug) revalidatePath(`/c/${slug}`);
  return {
    values: { ...values, page_enabled: "on", page_slug: slug, page_instagram: instagram },
    saved: true,
    notice: wasLive ? "saved" : "on",
  };
}
