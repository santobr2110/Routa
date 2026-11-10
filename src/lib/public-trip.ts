import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { CadasturSeal } from "@/lib/cadastur";
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
  /** Aceita cartão pelo link do organizador (migration 0010). O link não vem aqui. */
  accepts_card?: boolean;
  /** Valor no cartão (já com o padrão = valor do Pix); null se não aceita ou no rateio. */
  card_price_cents?: number | null;
  card_pillion_price_cents?: number | null;
  /** Prazo para pagar depois de garantir a vaga, em horas (migration 0011). */
  payment_deadline_hours?: number | null;
  /** Página do clube do organizador, se estiver no ar (migration 0012). */
  club?: { slug: string; name: string; logo_path: string | null; color: string | null } | null;
  /** A inscrição pede a placa da moto (migration 0006). */
  requires_plate: boolean;
  level: TripLevel;
  terrain: TripTerrain;
  terrain_percent: number;
  capacity: number;
  status: Exclude<TripStatus, "draft">;
  /** Publicada e antes do dia da saída (o banco calcula no fuso de Brasília). */
  registration_open: boolean;
  terms_text: string;
  organizer_name: string;
  /** Selo Cadastur válido do organizador (migration 0007) ou null. */
  organizer_cadastur: CadasturSeal | null;
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
