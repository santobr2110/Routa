// Área de administração (migration 0008). Quem é admin é o banco (private.admins);
// cada função admin_* confere de novo, então esconder a tela é só conforto, não segurança.

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { RegistrationStatus, PaymentStatus, TripStatus } from "@/types/database";

/** Exige login de admin; para os outros, a página "não existe" (404). */
export async function requireAdmin() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) notFound();
  return { user, supabase };
}

export const ADMIN_PAGE_SIZE = 50;

export type Dashboard = {
  users: { total: number; last_7d: number; last_30d: number; active_30d: number };
  organizers: { total: number; suspended: number };
  trips: {
    total: number;
    draft: number;
    published: number;
    closed: number;
    upcoming_open: number;
    hidden: number;
    last_30d: number;
    avg_occupancy: number | null;
  };
  registrations: {
    total: number;
    confirmed: number;
    waitlist: number;
    cancelled: number;
    paid: number;
    last_7d: number;
    last_30d: number;
  };
  money: { confirmed_cents: number; paid_cents: number };
  funnel: {
    signed_up: number;
    profile: number;
    created_trip: number;
    published_trip: number;
    got_registration: number;
  };
  weekly: { week: string; signups: number; trips: number; registrations: number }[];
  seals: { pending: number; active: number };
  stalled: {
    id: string;
    email: string | null;
    name: string | null;
    whatsapp: string | null;
    created_at: string;
    stage: "no_profile" | "no_trip";
  }[];
};

export type AdminUserRow = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  name: string | null;
  whatsapp: string | null;
  suspended_at: string | null;
  trips: number;
  published_trips: number;
  registrations: number;
  has_seal: boolean;
  is_admin: boolean;
};

export type AdminUserDetail = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  is_admin: boolean;
  organizer: {
    name: string;
    whatsapp: string;
    created_at: string;
    suspended_at: string | null;
    suspended_reason: string | null;
  } | null;
  trips: {
    id: string;
    slug: string;
    title: string;
    destination: string;
    start_date: string;
    end_date: string;
    status: TripStatus;
    capacity: number;
    admin_hidden_at: string | null;
    confirmed: number;
    waitlist: number;
  }[];
  seals: {
    id: string;
    cnpj: string;
    status: "pending" | "approved" | "rejected";
    valid_until: string;
    created_at: string;
    reviewed_at: string | null;
    reject_reason: string | null;
  }[];
  audit: AuditEntry[];
};

export type AdminTripRow = {
  id: string;
  slug: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  status: TripStatus;
  capacity: number;
  pricing_mode: "fixed" | "split";
  created_at: string;
  admin_hidden_at: string | null;
  deleted_at: string | null;
  deleted_by_admin: boolean;
  organizer_id: string;
  organizer_name: string;
  organizer_suspended_at: string | null;
  /** Migration 0017. */
  organizer_email: string | null;
  organizer_club: string | null;
  confirmed: number;
  waitlist: number;
  paid: number;
};

export type AdminTripDetail = {
  trip: {
    id: string;
    slug: string;
    title: string;
    destination: string;
    start_date: string;
    end_date: string;
    status: TripStatus;
    capacity: number;
    pricing_mode: "fixed" | "split";
    price_cents: number | null;
    pillion_price_cents: number | null;
    level: string;
    terrain: string;
    requires_plate: boolean;
    created_at: string;
    updated_at: string;
    admin_hidden_at: string | null;
    admin_hidden_reason: string | null;
    /** Lixeira (migration 0014). */
    deleted_at: string | null;
    deleted_by_admin: boolean;
    deleted_reason: string | null;
    purge_at: string | null;
    photos: number;
  };
  organizer: {
    id: string;
    name: string;
    whatsapp: string;
    suspended_at: string | null;
    email: string | null;
  };
  registrations: {
    name: string;
    bike: string;
    has_pillion: boolean;
    status: RegistrationStatus;
    payment_status: PaymentStatus;
    created_at: string;
    amount: number | null;
  }[];
  audit: AuditEntry[];
};

export type AuditEntry = {
  id?: number;
  action: string;
  target_type?: string;
  target_id?: string | null;
  target_label?: string | null;
  details: { reason?: string } | null;
  created_at: string;
  admin_email: string | null;
};

export type ActivityEvent = {
  kind: "signup" | "trip_created" | "registration" | "seal_requested";
  at: string;
  user_id: string | null;
  trip_id: string | null;
  label: string | null;
  extra: string | null;
};

export const ACTION_LABELS: Record<string, string> = {
  organizer_suspended: "Suspendeu o organizador",
  organizer_reactivated: "Reativou o organizador",
  trip_hidden: "Tirou a viagem do ar",
  trip_restored: "Pôs a viagem de volta no ar",
  trip_deleted: "Excluiu a viagem (lixeira)",
  trip_undeleted: "Restaurou a viagem da lixeira",
  cadastur_approved: "Aprovou o selo Cadastur",
  cadastur_rejected: "Recusou o selo Cadastur",
  site_settings_updated: "Mudou a aparência do site",
};

/** Porcentagem inteira (0 quando o total é 0). */
export function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/** Períodos do painel: dias e o agrupamento usado nos gráficos. */
export { PERIODS, type PeriodKey } from "./periods";

type Totals = {
  signups: number;
  organizers: number;
  trips: number;
  registrations: number;
  cancellations: number;
  value_cents: number;
  paid_cents: number;
  departures: number;
};
type KeyValue = { key: string; value: number };

export type Analytics = {
  from: string;
  to: string;
  bucket: "day" | "week" | "month";
  days: number;
  totals: Totals;
  previous: Totals;
  series: (Totals & {
    start: string;
    finish: string;
    users_total: number;
    organizers_total: number;
    trips_total: number;
  })[];
  breakdowns: {
    trips_by_terrain: KeyValue[];
    trips_by_level: KeyValue[];
    trips_by_status: KeyValue[];
    trips_by_pricing: KeyValue[];
    registrations_by_status: KeyValue[];
    pillion: { with: number; without: number };
    payment: { paid: number; pending: number };
    bike_brands: KeyValue[];
    destinations: KeyValue[];
    lead_time: KeyValue[];
    weekday: KeyValue[];
    occupancy: KeyValue[];
  };
  top_organizers: {
    id: string;
    name: string;
    trips: number;
    registrations: number;
    value_cents: number;
    paid: number;
    confirmed: number;
  }[];
  top_trips: {
    id: string;
    title: string;
    destination: string;
    start_date: string;
    capacity: number;
    organizer_name: string;
    registrations: number;
    confirmed: number;
    paid: number;
  }[];
};
