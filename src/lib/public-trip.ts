import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { PricingMode, TripLevel, TripStatus, TripTerrain } from "@/types/database";

/** O que a função get_public_trip devolve (sem chave Pix e sem dados de inscritos). */
export type PublicTrip = {
  id: string;
  slug: string;
  title: string;
  destination: string;
  description: string;
  start_date: string;
  end_date: string;
  departure_point: string;
  departure_point_url: string | null;
  departure_time: string | null; // "06:00"
  return_point: string | null;
  return_point_url: string | null;
  return_time: string | null;
  pricing_mode: PricingMode;
  price_cents: number | null;
  accepts_pillion: boolean;
  pillion_price_cents: number | null; // total piloto + garupa
  level: TripLevel;
  terrain: TripTerrain;
  terrain_percent: number;
  capacity: number;
  status: Exclude<TripStatus, "draft">;
  terms_text: string;
  organizer_name: string;
  spots_left: number;
  photos: string[];
};

/** Viagem publicada ou encerrada pelo slug, ou null (rascunho e inexistente dão null). */
export const getPublicTrip = cache(async (slug: string): Promise<PublicTrip | null> => {
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_trip", { p_slug: slug });
  if (error) throw error;
  return (data as PublicTrip | null) ?? null;
});
