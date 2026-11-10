import type { Metadata } from "next";
import Link from "next/link";
import { ADMIN_PAGE_SIZE, requireAdmin, type AdminTripRow } from "@/lib/admin";
import { TripTable, tripBadges } from "@/components/trip-table";
import { todayBR } from "@/lib/organizer-stats";

export const metadata: Metadata = {
  title: "Admin · Viagens",
  robots: { index: false },
};

const STATUS_FILTERS = {
  all: "Todas",
  published: "Inscrições abertas",
  draft: "Rascunho",
  closed: "Encerradas",
  hidden: "Fora do ar",
  deleted: "Lixeira",
} as const;
const PERIOD_FILTERS = {
  upcoming: "Próximas",
  past: "Passadas",
  all: "Qualquer data",
} as const;

type StatusFilter = keyof typeof STATUS_FILTERS;
type PeriodFilter = keyof typeof PERIOD_FILTERS;

export default async function AdminViagensPage({
  searchParams,
}: PageProps<"/painel/admin/viagens">) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const search = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const status: StatusFilter =
    typeof sp.status === "string" && sp.status in STATUS_FILTERS
      ? (sp.status as StatusFilter)
      : "all";
  const period: PeriodFilter =
    typeof sp.periodo === "string" && sp.periodo in PERIOD_FILTERS
      ? (sp.periodo as PeriodFilter)
      : "upcoming";
  const page = Math.max(1, Number(typeof sp.p === "string" ? sp.p : 1) || 1);

  const { data, error } = await supabase.rpc("admin_list_trips", {
    p_search: search || null,
    p_status: status,
    p_period: period,
    p_limit: ADMIN_PAGE_SIZE,
    p_offset: (page - 1) * ADMIN_PAGE_SIZE,
  });
  if (error) throw error;
  const { total, rows } = data as unknown as {
    total: number;
    rows: AdminTripRow[];
  };
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const today = todayBR();

  const href = (changes: Record<string, string>) => {
    const params = new URLSearchParams({
      ...(search ? { q: search } : {}),
      status,
      periodo: period,
      ...changes,
    });
    return `/painel/admin/viagens?${params}`;
  };

  return (
    <div className="space-y-6">
      <h1 className="page-title">Viagens</h1>

      <form className="flex max-w-xl gap-2" role="search">
        <input type="hidden" name="status" value={status} />
        <input type="hidden" name="periodo" value={period} />
        <label htmlFor="q" className="sr-only">
          Buscar por título, destino ou organizador
        </label>
        <input
          id="q"
          name="q"
          defaultValue={search}
          placeholder="Título, destino ou organizador"
          className="field-input mt-0 flex-1"
        />
        <button type="submit" className="btn-secondary w-auto shrink-0">
          Buscar
        </button>
      </form>

      <div className="space-y-2">
        <FilterRow
          label="Situação"
          options={STATUS_FILTERS}
          current={status}
          href={(v) => href({ status: v, p: "1" })}
        />
        <FilterRow
          label="Data"
          options={PERIOD_FILTERS}
          current={period}
          href={(v) => href({ periodo: v, p: "1" })}
        />
      </div>

      <p className="text-sm text-muted">{total} viagem(ns)</p>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-muted">
          Nenhuma viagem com esses filtros.
        </p>
      ) : (
        <TripTable
          label="Viagens"
          rows={rows.map((t) => ({
            id: t.id,
            href: `/painel/admin/viagens/${t.id}`,
            title: t.title,
            destination: t.destination,
            organizer: {
              name: t.organizer_name,
              suspended: !!t.organizer_suspended_at,
            },
            start_date: t.start_date,
            end_date: t.end_date,
            badges: tripBadges({
              status: t.status,
              past: t.end_date < today,
              hidden: !!t.admin_hidden_at,
              deleted: t.deleted_at
                ? t.deleted_by_admin
                  ? "admin"
                  : "organizer"
                : null,
            }),
            capacity: t.capacity,
            confirmed: t.confirmed,
            waitlist: t.waitlist,
            paid: t.paid,
            fixed: t.pricing_mode === "fixed",
          }))}
        />
      )}

      {pages > 1 && (
        <nav
          className="flex items-center justify-between gap-2"
          aria-label="Páginas"
        >
          {page > 1 ? (
            <Link
              href={href({ p: String(page - 1) })}
              className="inline-flex min-h-9 items-center text-sm font-medium text-accent"
            >
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Página {page} de {pages}
          </span>
          {page < pages ? (
            <Link
              href={href({ p: String(page + 1) })}
              className="inline-flex min-h-9 items-center text-sm font-medium text-accent"
            >
              Próxima →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}

function FilterRow<T extends string>({
  label,
  options,
  current,
  href,
}: {
  label: string;
  options: Record<T, string>;
  current: T;
  href: (value: T) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 text-sm text-muted">{label}</span>
      {(Object.entries(options) as [T, string][]).map(([value, text]) => (
        <Link
          key={value}
          href={href(value)}
          aria-current={value === current ? "true" : undefined}
          className="inline-flex min-h-9 items-center rounded-md border border-line px-2.5 text-sm text-ink-soft hover:text-ink aria-[current=true]:border-ink aria-[current=true]:font-medium aria-[current=true]:text-ink"
        >
          {text}
        </Link>
      ))}
    </div>
  );
}
