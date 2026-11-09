import { supabaseUrl } from "@/lib/supabase/env";
import type { TripLevel, TripStatus, TripTerrain } from "@/types/database";

// Campos do formulário de viagem (nomes dos inputs).
export const TRIP_FIELDS = [
  "title",
  "destination",
  "description",
  "start_date",
  "end_date",
  "departure_point",
  "departure_point_url",
  "departure_time",
  "return_point",
  "return_point_url",
  "return_time",
  "pricing_mode",
  "price",
  "pillion_price",
  "accepts_pillion",
  "level",
  "terrain",
  "terrain_percent",
  "capacity",
  "requires_plate",
  "pix_key",
  "terms_text",
] as const;

export type TripField = (typeof TRIP_FIELDS)[number];
export type TripFormValues = Record<TripField, string>;

export type TripFormState = {
  errors?: Partial<Record<TripField | "form", string>>;
  values?: TripFormValues;
  saved?: boolean;
};

export const MAX_PHOTOS = 5;
export const PHOTOS_BUCKET = "trip-photos";

export const LEVEL_LABELS: Record<TripLevel, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  experienced: "Estradeiro experiente",
};

export const TERRAIN_LABELS: Record<TripTerrain, string> = {
  asphalt: "Asfalto",
  mixed: "Misto",
  offroad: "Off-road",
};

export const STATUS_LABELS: Record<TripStatus, string> = {
  draft: "Rascunho",
  published: "Inscrições abertas",
  closed: "Inscrições encerradas",
};

/** Termo de responsabilidade padrão. O organizador pode editar à vontade. */
export const DEFAULT_TERMS = `Declaro que:

1. Estou habilitado(a) na categoria A e que minha moto está com a documentação em dia e em boas condições de uso (pneus, freios, luzes, corrente/cardã).
2. Participo desta viagem por livre e espontânea vontade, sabendo que pilotar moto em estrada envolve riscos de acidente, queda e lesões.
3. Sou o único responsável pela minha pilotagem, pela minha moto e pelo(a) garupa que eu levar, e vou respeitar as leis de trânsito, os limites de velocidade e as orientações do organizador.
4. Vou usar capacete e equipamentos de proteção durante todo o trajeto.
5. Não vou pilotar depois de consumir bebida alcoólica ou qualquer substância que prejudique a direção.
6. O organizador não é empresa de turismo: a viagem é entre amigos, com custos divididos, e ele não responde por danos, acidentes, furtos ou prejuízos que aconteçam comigo, com meu(minha) garupa ou com minha moto.
7. Os dados que informei (incluindo o contato de emergência) são verdadeiros e podem ser usados pelo organizador só para organizar esta viagem e em caso de emergência.`;

/** URL pública de uma foto do bucket trip-photos. */
export function photoUrl(storagePath: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${PHOTOS_BUCKET}/${storagePath}`;
}

/** Mensagem padrão para compartilhar no WhatsApp (CLAUDE.md, seção 7). */
export function shareMessage(destination: string, dates: string, link: string): string {
  return `🧭 Bora pra ${destination}? ${dates}. Garante sua vaga 👉 ${link}`;
}
