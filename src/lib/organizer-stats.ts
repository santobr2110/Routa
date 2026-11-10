/**
 * Números do painel do organizador, calculados a partir das viagens e inscrições dele.
 *
 * Os dados chegam pelo Supabase com RLS (o organizador só lê o que é dele), então aqui
 * não há nada de segurança: só contas. Funções puras, sem acesso ao banco.
 * Datas sempre no fuso de Brasília.
 */
import { amountDue, isOverdue } from "./registrations";
import { PERIODS, type Bucket, type PeriodKey } from "./periods";
import type { Database } from "@/types/database";

type TripRow = Database["public"]["Tables"]["trips"]["Row"];
type RegRow = Database["public"]["Tables"]["registrations"]["Row"];

export type StatsTrip = Pick<
  TripRow,
  | "id"
  | "title"
  | "destination"
  | "start_date"
  | "end_date"
  | "status"
  | "capacity"
  | "pricing_mode"
  | "price_cents"
  | "pillion_price_cents"
  | "created_at"
  | "admin_hidden_at"
>;
export type StatsReg = Pick<
  RegRow,
  | "id"
  | "trip_id"
  | "name"
  | "whatsapp"
  | "bike"
  | "bike_brand"
  | "bike_model"
  | "has_pillion"
  | "status"
  | "payment_status"
  | "created_at"
  | "cancelled_at"
  | "payment_due_at"
>;

export const STATS_TRIP_COLUMNS =
  "id, title, destination, start_date, end_date, status, capacity, pricing_mode, price_cents, pillion_price_cents, created_at, admin_hidden_at" as const;
export const STATS_REG_COLUMNS =
  "id, trip_id, name, whatsapp, bike, bike_brand, bike_model, has_pillion, status, payment_status, created_at, cancelled_at, payment_due_at" as const;

export type KeyValue = { key: string; value: number };

// ---------------------------------------------------------------------------
// Datas (YYYY-MM-DD, fuso de Brasília)
// ---------------------------------------------------------------------------

const BR_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Instante (ISO) → data local de Brasília, "2026-11-10". */
export function localDate(iso: string): string {
  return BR_DATE.format(new Date(iso));
}

export function todayBR(now = new Date()): string {
  return BR_DATE.format(now);
}

/** Soma dias a uma data "YYYY-MM-DD" (em UTC, sem fuso). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Dias de a até b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function startOf(date: string, bucket: Bucket): string {
  if (bucket === "day") return date;
  if (bucket === "month") return `${date.slice(0, 7)}-01`;
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = domingo
  return addDays(date, -((dow + 6) % 7)); // semana começa na segunda
}

function nextStart(start: string, bucket: Bucket): string {
  if (bucket === "day") return addDays(start, 1);
  if (bucket === "week") return addDays(start, 7);
  const [y, m] = start.split("-").map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/** Faixas do gráfico entre from e to (inclusive), cortadas nas pontas. */
export function makeBuckets(from: string, to: string, bucket: Bucket) {
  const out: { start: string; finish: string }[] = [];
  for (let s = startOf(from, bucket); s <= to; s = nextStart(s, bucket)) {
    const finish = addDays(nextStart(s, bucket), -1);
    out.push({ start: s < from ? from : s, finish: finish > to ? to : finish });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ajudantes
// ---------------------------------------------------------------------------

const LEAD_TIME = [
  { label: "0–7 dias", lo: 0, hi: 7 },
  { label: "8–14 dias", lo: 8, hi: 14 },
  { label: "15–30 dias", lo: 15, hi: 30 },
  { label: "31–60 dias", lo: 31, hi: 60 },
  { label: "mais de 60 dias", lo: 61, hi: Infinity },
];
const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function brandOf(r: StatsReg): string {
  if (r.bike_brand) return r.bike_brand;
  const first = r.bike.trim().split(/\s+/)[0] ?? "";
  return first ? first[0]!.toUpperCase() + first.slice(1).toLowerCase() : "Outra";
}

function countBy<T>(items: T[], key: (item: T) => string, limit?: number): KeyValue[] {
  const map = new Map<string, number>();
  for (const item of items) map.set(key(item), (map.get(key(item)) ?? 0) + 1);
  const list = [...map].map(([k, value]) => ({ key: k, value }));
  list.sort((a, b) => b.value - a.value || a.key.localeCompare(b.key, "pt-BR"));
  return limit ? list.slice(0, limit) : list;
}

function leadTime(regs: StatsReg[], tripsById: Map<string, StatsTrip>): KeyValue[] {
  return LEAD_TIME.map((b) => ({
    key: b.label,
    value: regs.filter((r) => {
      const trip = tripsById.get(r.trip_id);
      if (!trip) return false;
      const days = daysBetween(localDate(r.created_at), trip.start_date);
      return days >= b.lo && days <= b.hi;
    }).length,
  }));
}

function weekday(regs: StatsReg[]): KeyValue[] {
  const counts = new Array(7).fill(0) as number[];
  for (const r of regs) {
    const dow = new Date(`${localDate(r.created_at)}T00:00:00Z`).getUTCDay();
    counts[(dow + 6) % 7]!++;
  }
  return WEEKDAYS.map((key, i) => ({ key, value: counts[i]! }));
}

function amountOf(r: StatsReg, tripsById: Map<string, StatsTrip>): number {
  const trip = tripsById.get(r.trip_id);
  return trip ? (amountDue(trip, r.has_pillion) ?? 0) : 0;
}

/** Primeira data (local) em que cada WhatsApp se inscreveu (sem contar canceladas). */
function firstSeen(regs: StatsReg[]): Map<string, string> {
  const first = new Map<string, string>();
  for (const r of regs) {
    if (r.status === "cancelled") continue;
    const d = localDate(r.created_at);
    const prev = first.get(r.whatsapp);
    if (!prev || d < prev) first.set(r.whatsapp, d);
  }
  return first;
}

// ---------------------------------------------------------------------------
// Visão geral
// ---------------------------------------------------------------------------

export type OrganizerTotals = {
  registrations: number;
  new_participants: number;
  returning_participants: number;
  cancellations: number;
  value_cents: number;
  paid_cents: number;
  departures: number;
};

export type UpcomingTrip = {
  id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  status: StatsTrip["status"];
  hidden: boolean;
  capacity: number;
  confirmed: number;
  waitlist: number;
  paid: number;
  overdue: number;
  fixed: boolean;
  value_cents: number;
  paid_cents: number;
  days_left: number;
};

export type OrganizerOverview = ReturnType<typeof organizerOverview>;

export function organizerOverview(
  trips: StatsTrip[],
  regs: StatsReg[],
  period: PeriodKey,
  now = new Date(),
) {
  const { days, bucket } = PERIODS[period];
  const to = todayBR(now);
  const from = addDays(to, -(days - 1));
  const prevFrom = addDays(from, -days);
  const prevTo = addDays(from, -1);
  const tripsById = new Map(trips.map((t) => [t.id, t]));
  const first = firstSeen(regs);

  const totals = (a: string, b: string): OrganizerTotals => {
    const inRange = regs.filter((r) => {
      const d = localDate(r.created_at);
      return d >= a && d <= b;
    });
    const active = inRange.filter((r) => r.status !== "cancelled");
    const people = new Set(active.map((r) => r.whatsapp));
    let newPeople = 0;
    for (const w of people) {
      const f = first.get(w);
      if (f && f >= a && f <= b) newPeople++;
    }
    const confirmed = inRange.filter((r) => r.status === "confirmed");
    return {
      registrations: inRange.length,
      new_participants: newPeople,
      returning_participants: people.size - newPeople,
      cancellations: regs.filter((r) => {
        if (!r.cancelled_at) return false;
        const d = localDate(r.cancelled_at);
        return d >= a && d <= b;
      }).length,
      value_cents: confirmed.reduce((s, r) => s + amountOf(r, tripsById), 0),
      paid_cents: confirmed
        .filter((r) => r.payment_status === "paid")
        .reduce((s, r) => s + amountOf(r, tripsById), 0),
      departures: trips.filter(
        (t) => t.status !== "draft" && t.start_date >= a && t.start_date <= b,
      ).length,
    };
  };

  const series = makeBuckets(from, to, bucket).map((b) => {
    const inBucket = regs.filter((r) => {
      const d = localDate(r.created_at);
      return d >= b.start && d <= b.finish;
    });
    const confirmed = inBucket.filter((r) => r.status === "confirmed");
    return {
      start: b.start,
      finish: b.finish,
      values: {
        confirmed: confirmed.length,
        waitlist: inBucket.filter((r) => r.status === "waitlist").length,
        cancellations: regs.filter(
          (r) =>
            r.cancelled_at &&
            localDate(r.cancelled_at) >= b.start &&
            localDate(r.cancelled_at) <= b.finish,
        ).length,
        value: confirmed.reduce((s, r) => s + amountOf(r, tripsById), 0),
        paid: confirmed
          .filter((r) => r.payment_status === "paid")
          .reduce((s, r) => s + amountOf(r, tripsById), 0),
      },
    };
  });

  // Próximas saídas: o que ainda não aconteceu (inclusive rascunhos, para lembrar).
  const upcoming: UpcomingTrip[] = trips
    .filter((t) => t.end_date >= to)
    .map((t) => {
      const tr = regs.filter((r) => r.trip_id === t.id);
      const confirmed = tr.filter((r) => r.status === "confirmed");
      const paid = confirmed.filter((r) => r.payment_status === "paid");
      return {
        id: t.id,
        title: t.title,
        destination: t.destination,
        start_date: t.start_date,
        end_date: t.end_date,
        status: t.status,
        hidden: !!t.admin_hidden_at,
        capacity: t.capacity,
        confirmed: confirmed.length,
        waitlist: tr.filter((r) => r.status === "waitlist").length,
        paid: paid.length,
        overdue: confirmed.filter((r) => isOverdue(r, now.getTime())).length,
        fixed: t.pricing_mode === "fixed",
        value_cents: confirmed.reduce((s, r) => s + amountOf(r, tripsById), 0),
        paid_cents: paid.reduce((s, r) => s + amountOf(r, tripsById), 0),
        days_left: daysBetween(to, t.start_date),
      };
    })
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  const open = upcoming.filter((t) => t.status === "published" && !t.hidden);
  const live = upcoming.filter((t) => t.status !== "draft");
  const seats = open.reduce((s, t) => s + t.capacity, 0);
  const filled = open.reduce((s, t) => s + Math.min(t.confirmed, t.capacity), 0);
  const confirmedNow = live.reduce((s, t) => s + t.confirmed, 0);
  const paidNow = live.reduce((s, t) => s + t.paid, 0);

  const inPeriod = regs.filter((r) => {
    const d = localDate(r.created_at);
    return d >= from && d <= to && r.status !== "cancelled";
  });
  const confirmedInPeriod = inPeriod.filter((r) => r.status === "confirmed");

  return {
    from,
    to,
    bucket,
    totals: totals(from, to),
    previous: totals(prevFrom, prevTo),
    series,
    now: {
      open_trips: open.length,
      seats,
      filled,
      waitlist: live.reduce((s, t) => s + t.waitlist, 0),
      confirmed: confirmedNow,
      paid: paidNow,
      to_receive_cents: live.reduce((s, t) => s + (t.value_cents - t.paid_cents), 0),
      received_cents: live.reduce((s, t) => s + t.paid_cents, 0),
      participants: first.size,
    },
    upcoming,
    breakdowns: {
      lead_time: leadTime(inPeriod, tripsById),
      weekday: weekday(inPeriod),
      bike_brands: countBy(inPeriod, brandOf, 8),
      group: [
        { key: "Vai sozinho(a)", value: confirmedInPeriod.filter((r) => !r.has_pillion).length },
        { key: "Vai com garupa", value: confirmedInPeriod.filter((r) => r.has_pillion).length },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Participantes (todo mundo que já se inscreveu com o organizador)
// ---------------------------------------------------------------------------

export type Participant = {
  whatsapp: string;
  name: string;
  bike: string;
  trips: number; // viagens em que esteve confirmado
  past: number; // dessas, quantas já aconteceram
  upcoming: { id: string; title: string; start_date: string } | null;
  last: { id: string; title: string; start_date: string } | null;
  first_date: string;
  pillion: number;
  waitlist: number;
};

export function participants(trips: StatsTrip[], regs: StatsReg[], now = new Date()) {
  const today = todayBR(now);
  const tripsById = new Map(trips.map((t) => [t.id, t]));
  const byPerson = new Map<string, StatsReg[]>();
  for (const r of regs) {
    if (r.status === "cancelled" || !tripsById.has(r.trip_id)) continue;
    const list = byPerson.get(r.whatsapp) ?? [];
    list.push(r);
    byPerson.set(r.whatsapp, list);
  }

  const people: Participant[] = [];
  for (const [whatsapp, list] of byPerson) {
    list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const latest = list[list.length - 1]!;
    const confirmed = list.filter((r) => r.status === "confirmed");
    const confirmedTrips = confirmed
      .map((r) => tripsById.get(r.trip_id)!)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
    const past = confirmedTrips.filter((t) => t.end_date < today);
    const next = confirmedTrips.find((t) => t.end_date >= today) ?? null;
    const last = past[past.length - 1] ?? null;
    people.push({
      whatsapp,
      name: latest.name,
      bike:
        latest.bike_brand && latest.bike_model
          ? `${latest.bike_brand} ${latest.bike_model}`
          : latest.bike,
      trips: confirmedTrips.length,
      past: past.length,
      upcoming: next && { id: next.id, title: next.title, start_date: next.start_date },
      last: last && { id: last.id, title: last.title, start_date: last.start_date },
      first_date: localDate(list[0]!.created_at),
      pillion: confirmed.filter((r) => r.has_pillion).length,
      waitlist: list.filter((r) => r.status === "waitlist").length,
    });
  }
  people.sort(
    (a, b) =>
      b.trips - a.trips ||
      (b.last?.start_date ?? "").localeCompare(a.last?.start_date ?? "") ||
      a.name.localeCompare(b.name, "pt-BR"),
  );
  return people;
}

// ---------------------------------------------------------------------------
// Números de uma viagem
// ---------------------------------------------------------------------------

export function tripNumbers(
  trip: StatsTrip,
  allRegs: StatsReg[],
  now = new Date(),
) {
  const today = todayBR(now);
  const regs = allRegs.filter((r) => r.trip_id === trip.id);
  const tripsById = new Map([[trip.id, trip]]);
  const active = regs.filter((r) => r.status !== "cancelled");
  const confirmed = regs.filter((r) => r.status === "confirmed");
  const paid = confirmed.filter((r) => r.payment_status === "paid");

  // Quem também se inscreveu em outra viagem do mesmo organizador.
  const otherBefore = new Set(
    allRegs
      .filter((r) => r.trip_id !== trip.id && r.status !== "cancelled")
      .map((r) => r.whatsapp),
  );
  const returning = active.filter((r) => otherBefore.has(r.whatsapp)).length;

  // Curva de enchimento: inscrições ativas acumuladas (confirmados + fila), do dia em que
  // a viagem foi criada até a saída (ou hoje). Quem cancelou conta até o dia do cancelamento.
  const start = localDate(trip.created_at);
  const end = [today, trip.start_date].sort()[0]!;
  const span = Math.max(daysBetween(start, end), 0) + 1;
  const bucket: Bucket = span > 120 ? "week" : "day";
  const curve =
    end >= start
      ? makeBuckets(start, end, bucket).map((b) => ({
          start: b.start,
          finish: b.finish,
          values: {
            registrations: regs.filter(
              (r) =>
                localDate(r.created_at) <= b.finish &&
                (r.status !== "cancelled" ||
                  (!!r.cancelled_at && localDate(r.cancelled_at) > b.finish)),
            ).length,
            capacity: trip.capacity,
          },
        }))
      : [];

  return {
    tripId: trip.id,
    capacity: trip.capacity,
    confirmed: confirmed.length,
    waitlist: regs.filter((r) => r.status === "waitlist").length,
    cancelled: regs.filter((r) => r.status === "cancelled").length,
    paid: paid.length,
    fixed: trip.pricing_mode === "fixed",
    value_cents: confirmed.reduce((s, r) => s + amountOf(r, tripsById), 0),
    paid_cents: paid.reduce((s, r) => s + amountOf(r, tripsById), 0),
    pillion: confirmed.filter((r) => r.has_pillion).length,
    returning,
    first_timers: active.length - returning,
    days_left: daysBetween(today, trip.start_date),
    bucket,
    curve,
    lead_time: leadTime(active, tripsById),
    weekday: weekday(active),
    bike_brands: countBy(active, brandOf, 8),
  };
}
