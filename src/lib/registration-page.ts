import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** Página do inscrito (migration 0013): o que get_registration_page devolve pelo token. */
export type RegistrationPage = {
  registration: {
    id: string;
    name: string;
    status: "confirmed" | "waitlist" | "cancelled";
    created_at: string;
    cancelled_at: string | null;
    has_pillion: boolean;
    pillion_name: string | null;
    bike: string;
    payment_status: "pending" | "paid";
    payment_due_at: string | null;
    released_at: string | null;
    promoted_at: string | null;
    terms_accepted_at: string;
    terms_text_accepted: string;
    waitlist_position: number | null;
    amount_cents: number | null;
  };
  trip: {
    slug: string;
    title: string;
    destination: string;
    description: string | null;
    start_date: string;
    end_date: string;
    departure_point: string;
    departure_point_url: string | null;
    departure_time: string | null;
    return_point: string | null;
    return_point_url: string | null;
    return_time: string | null;
    pricing_mode: "fixed" | "split";
    status: "draft" | "published" | "closed";
    unavailable: boolean;
    /** Excluída pelo organizador ou pela administração (lixeira, migration 0014). */
    deleted: boolean;
    cover: string | null;
  };
  organizer: {
    name: string;
    whatsapp: string;
    club: { slug: string; name: string; logo_path: string | null; color: string | null } | null;
  };
  payment: {
    pix_key: string;
    card: { url: string; amount_cents: number | null } | null;
  } | null;
  updates: { id: string; body: string; created_at: string }[];
};

/** Formato do token: 32 caracteres hexadecimais. */
export function isAccessToken(token: string): boolean {
  return /^[0-9a-f]{32}$/.test(token);
}

export const getRegistrationPage = cache(async (token: string): Promise<RegistrationPage | null> => {
  if (!isAccessToken(token)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_registration_page", { p_token: token });
  if (error) throw error;
  return (data as RegistrationPage | null) ?? null;
});
