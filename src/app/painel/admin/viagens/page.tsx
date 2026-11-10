import type { Metadata } from "next";
import Link from "next/link";
import { ADMIN_PAGE_SIZE, requireAdmin, type AdminTripRow } from "@/lib/admin";
import { formatDateRangeBR } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/trips";
import { Badge } from "../stat";

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
        <>
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-muted/50 text-muted">
                  <th className="px-4 py-2 font-medium">Viagem</th>
                  <th className="px-4 py-2 font-medium">Datas</th>
                  <th className="px-4 py-2 font-medium">Organizador</th>
                  <th className="px-4 py-2 font-medium">Situação</th>
                  <th className="px-4 py-2 font-medium">Ocupação</th>
                  <th className="px-4 py-2 text-right font-medium">Fila</th>
                  <th className="px-4 py-2 text-right font-medium">Pagos</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const pct =
                    t.capacity > 0
                      ? Math.min((t.confirmed / t.capacity) * 100, 100)
                      : 0;
                  return (
                    <tr
                      key={t.id}
                      className="border-b border-line last:border-0 hover:bg-surface-muted/50"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/painel/admin/viagens/${t.id}`}
                          className="font-medium hover:text-accent"
                        >
                          {t.title}
                        </Link>
                        <span className="block text-xs text-muted">
                          {t.destination}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {formatDateRangeBR(t.start_date, t.end_date)}
                      </td>
                      <td className="px-4 py-2.5">
                        {t.organizer_name}
                        {t.organizer_suspended_at && (
                          <span className="ml-1.5">
                            <Badge tone="danger">Suspenso</Badge>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          <Badge
                            tone={
                              t.status === "published" ? "success" : "muted"
                            }
                          >
                            {STATUS_LABELS[t.status]}
                          </Badge>
                          {t.admin_hidden_at && (
                            <Badge tone="danger">Fora do ar</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex min-w-28 items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-surface-muted">
                            <div
                              className="h-1.5 rounded-full bg-series-1"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted tabular-nums">
                            {t.confirmed}/{t.capacity}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {t.waitlist}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {t.pricing_mode === "fixed"
                          ? `${t.paid}/${t.confirmed}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2 md:hidden">
            {rows.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/painel/admin/viagens/${t.id}`}
                  className="card block space-y-1 p-4 hover:border-line-hover"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium break-words">{t.title}</p>
                    <Badge
                      tone={t.status === "published" ? "success" : "muted"}
                    >
                      {STATUS_LABELS[t.status]}
                    </Badge>
                    {t.admin_hidden_at && (
                      <Badge tone="danger">Fora do ar</Badge>
                    )}
                    {t.organizer_suspended_at && (
                      <Badge tone="danger">Organizador suspenso</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted">
                    {t.destination} ·{" "}
                    {formatDateRangeBR(t.start_date, t.end_date)} · por{" "}
                    {t.organizer_name}
                  </p>
                  <p className="text-sm text-ink-soft">
                    {t.confirmed}/{t.capacity} confirmados
                    {t.waitlist > 0 && ` · ${t.waitlist} na fila`}
                    {t.pricing_mode === "fixed" && ` · ${t.paid} pagos`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
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
