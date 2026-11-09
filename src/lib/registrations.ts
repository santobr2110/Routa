import type { Database } from "@/types/database";

type Trip = Pick<
  Database["public"]["Tables"]["trips"]["Row"],
  "pricing_mode" | "price_cents" | "pillion_price_cents"
>;

/** Valor que a inscrição deve pagar, ou null no rateio (o organizador define). */
export function amountDue(trip: Trip, hasPillion: boolean): number | null {
  if (trip.pricing_mode !== "fixed") return null;
  return hasPillion ? (trip.pillion_price_cents ?? trip.price_cents) : trip.price_cents;
}

/** Colunas lidas na lista de inscritos e no CSV. */
export const REGISTRATION_COLUMNS =
  "id, name, whatsapp, email, bike, bike_brand, bike_model, bike_year, bike_color, bike_plate, has_pillion, pillion_name, emergency_name, emergency_phone, payment_status, status, created_at" as const;
