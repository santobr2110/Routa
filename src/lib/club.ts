/** Página do clube (migration 0012): campos do formulário, tipos e leitura pública. */
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const CLUB_FIELDS = [
  "page_enabled",
  "page_slug",
  "page_name",
  "page_bio",
  "page_city",
  "page_instagram",
  "page_show_whatsapp",
  "page_color",
  "page_logo_path",
  "page_cover_path",
] as const;
export type ClubField = (typeof CLUB_FIELDS)[number];
export type ClubValues = Record<ClubField, string>;
export type ClubState = {
  values?: ClubValues;
  errors?: Partial<Record<ClubField | "form", string>>;
  saved?: boolean;
  /** O que aconteceu no último envio: alterações salvas, página ligada ou desligada. */
  notice?: "saved" | "on" | "off";
};


/** Dados públicos da página do clube (get_club_page). */
export type ClubPage = {
  slug: string;
  name: string;
  bio: string | null;
  city: string | null;
  instagram: string | null;
  whatsapp: string | null;
  color: string | null;
  logo_path: string | null;
  cover_path: string | null;
  organizer_name: string;
  since: string;
  cadastur: { valid_until: string; verified_at: string } | null;
  stats: { trips_done: number; travelers: number; returning: number };
  upcoming: {
    slug: string;
    title: string;
    destination: string;
    start_date: string;
    end_date: string;
    level: string;
    terrain: string;
    pricing_mode: "fixed" | "split";
    price_cents: number | null;
    capacity: number;
    spots_left: number;
    registration_open: boolean;
    cover: string | null;
  }[];
  past: {
    slug: string;
    title: string;
    destination: string;
    start_date: string;
    travelers: number;
    cover: string | null;
  }[];
};

/** Página do clube pelo endereço (null se não existir, estiver desligada ou suspensa). */
export const getClubPage = cache(async (slug: string): Promise<ClubPage | null> => {
  if (!/^[a-z0-9-]{3,40}$/i.test(slug)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_club_page", { p_slug: slug.toLowerCase() });
  if (error) throw error;
  return (data as ClubPage | null) ?? null;
});
