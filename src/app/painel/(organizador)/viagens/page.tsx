import type { Metadata } from "next";
import Link from "next/link";
import { TripTable, tripBadges, type TripTableRow } from "@/components/trip-table";
import { requireOrganizer } from "@/lib/auth";
import { loadOrganizerData } from "@/lib/organizer-data";
import { todayBR } from "@/lib/organizer-stats";
import { amountDue, isOverdue } from "@/lib/registrations";
import { getDeletedTrips } from "@/lib/reauth";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABELS, photoUrl } from "@/lib/trips";

export const metadata: Metadata = { title: "Viagens" };

const FILTERS = {
  proximas: "Próximas",
  rascunhos: "Rascunhos",
  passadas: "Já aconteceram",
  todas: "Todas",
} as const;
type Filter = keyof typeof FILTERS;

export default async function ViagensPage({ searchParams }: PageProps<"/painel/viagens">) {
  await requireOrganizer();
  const { filtro } = await searchParams;
  const filter: Filter =
    typeof filtro === "string" && filtro in FILTERS ? (filtro as Filter) : "proximas";

  const supabase = await createClient();
  const [{ trips, regs }, { data: photos }, deleted] = await Promise.all([
    loadOrganizerData(),
    supabase.from("trip_photos").select("trip_id, storage_path, position").eq("position", 0),
    getDeletedTrips(),
  ]);
  const covers = new Map((photos ?? []).map((p) => [p.trip_id, p.storage_path]));
  const today = todayBR();

  const rows = trips.map((t) => {
    const tr = regs.filter((r) => r.trip_id === t.id);
    const confirmed = tr.filter((r) => r.status === "confirmed");
    const paid = confirmed.filter((r) => r.payment_status === "paid");
    const sum = (list: typeof tr) =>
      list.reduce((s, r) => s + (amountDue(t, r.has_pillion) ?? 0), 0);
    return {
      ...t,
      confirmed: confirmed.length,
      waitlist: tr.filter((r) => r.status === "waitlist").length,
      paid: paid.length,
      overdue: confirmed.filter((r) => isOverdue(r)).length,
      value_cents: sum(confirmed),
      paid_cents: sum(paid),
      past: t.end_date < today,
    };
  });

  const matches = {
    proximas: (r: (typeof rows)[number]) => !r.past && r.status !== "draft",
    rascunhos: (r: (typeof rows)[number]) => r.status === "draft",
    passadas: (r: (typeof rows)[number]) => r.past && r.status !== "draft",
    todas: () => true,
  };
  const shown = rows.filter(matches[filter]);
  // Próximas: a mais perto primeiro. Demais: a mais recente primeiro.
  if (filter !== "proximas") shown.reverse();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Viagens</h1>
        <Link href="/painel/viagens/nova" className="btn-primary">
          + Criar viagem
        </Link>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Filtrar viagens">
        {(Object.entries(FILTERS) as [Filter, string][]).map(([key, label]) => (
          <Link
            key={key}
            href={key === "proximas" ? "/painel/viagens" : `/painel/viagens?filtro=${key}`}
            aria-current={key === filter ? "page" : undefined}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm text-ink-soft hover:text-ink aria-[current=page]:border-ink aria-[current=page]:font-medium aria-[current=page]:text-ink"
          >
            {label}
            <span className="text-xs text-muted tabular-nums">{rows.filter(matches[key]).length}</span>
          </Link>
        ))}
        {deleted.length > 0 && (
          <Link
            href="/painel/viagens/lixeira"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm text-ink-soft hover:text-ink sm:ml-auto"
          >
            🗑 Lixeira
            <span className="text-xs text-muted tabular-nums">{deleted.length}</span>
          </Link>
        )}
      </nav>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">
          {trips.length === 0 ? "Você ainda não criou nenhuma viagem." : "Nenhuma viagem aqui."}
        </p>
      ) : (
        <TripTable label="Suas viagens" rows={shown.map((t) => toRow(t, covers.get(t.id)))} />
      )}
    </div>
  );
}

type Row = {
  status: keyof typeof STATUS_LABELS;
  past: boolean;
  admin_hidden_at: string | null;
  id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  capacity: number;
  confirmed: number;
  waitlist: number;
  paid: number;
  overdue: number;
  pricing_mode: string;
  value_cents: number;
  paid_cents: number;
};

function toRow(t: Row, cover: string | undefined): TripTableRow {
  const base = `/painel/viagens/${t.id}`;
  return {
    id: t.id,
    href: base,
    title: t.title,
    destination: t.destination,
    cover: cover ? photoUrl(cover) : null,
    start_date: t.start_date,
    end_date: t.end_date,
    badges: tripBadges({ status: t.status, past: t.past, hidden: !!t.admin_hidden_at }),
    capacity: t.capacity,
    confirmed: t.confirmed,
    waitlist: t.waitlist,
    paid: t.paid,
    overdue: t.past ? 0 : t.overdue,
    fixed: t.pricing_mode === "fixed",
    value_cents: t.value_cents,
    paid_cents: t.paid_cents,
    chargeHref: t.past ? undefined : `${base}/cobranca`,
    links: [
      { href: `${base}/inscritos`, label: "Inscritos", icon: "people" },
      { href: `${base}/numeros`, label: "Números", icon: "chart" },
    ],
  };
}
