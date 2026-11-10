import type { Metadata } from "next";
import Link from "next/link";
import { CompassIcon } from "@/components/logo";
import { Occupancy } from "@/components/stats";
import { requireOrganizer } from "@/lib/auth";
import { formatBRL, formatDateRangeBR } from "@/lib/format";
import { loadOrganizerData } from "@/lib/organizer-data";
import { todayBR } from "@/lib/organizer-stats";
import { amountDue } from "@/lib/registrations";
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
  const [{ trips, regs }, { data: photos }] = await Promise.all([
    loadOrganizerData(),
    supabase.from("trip_photos").select("trip_id, storage_path, position").eq("position", 0),
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
      </nav>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">
          {trips.length === 0 ? "Você ainda não criou nenhuma viagem." : "Nenhuma viagem aqui."}
        </p>
      ) : (
        <>
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-muted/50 text-muted">
                  <th className="px-4 py-2 font-medium">Viagem</th>
                  <th className="px-4 py-2 font-medium">Datas</th>
                  <th className="px-4 py-2 font-medium">Situação</th>
                  <th className="px-4 py-2 font-medium">Ocupação</th>
                  <th className="px-4 py-2 text-right font-medium">Fila</th>
                  <th className="px-4 py-2 text-right font-medium">Pagos</th>
                  <th className="px-4 py-2 text-right font-medium">Valor</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {shown.map((t) => (
                  <tr key={t.id} className="border-b border-line last:border-0 hover:bg-surface-muted/50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <Cover path={covers.get(t.id)} className="h-10 w-10" />
                        <div className="min-w-0">
                          <Link href={`/painel/viagens/${t.id}`} className="font-medium hover:text-accent">
                            {t.title}
                          </Link>
                          <span className="block text-xs text-muted">{t.destination}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {formatDateRangeBR(t.start_date, t.end_date)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {t.past && t.status !== "draft" ? "Realizada" : STATUS_LABELS[t.status]}
                      {t.admin_hidden_at && (
                        <span className="block text-xs text-danger">fora do ar</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Occupancy confirmed={t.confirmed} capacity={t.capacity} />
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{t.waitlist}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {t.paid}/{t.confirmed}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">
                      {t.pricing_mode === "fixed" ? formatBRL(t.value_cents) : "rateio"}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <Link
                        href={`/painel/viagens/${t.id}/inscritos`}
                        className="text-sm font-medium text-accent hover:underline"
                      >
                        Inscritos
                      </Link>
                      <span className="text-faint"> · </span>
                      <Link
                        href={`/painel/viagens/${t.id}/numeros`}
                        className="text-sm font-medium text-accent hover:underline"
                      >
                        Números
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="grid gap-2 md:hidden">
            {shown.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/painel/viagens/${t.id}`}
                  className="card flex items-center gap-3 p-3 hover:border-line-hover"
                >
                  <Cover path={covers.get(t.id)} className="h-14 w-14" />
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block truncate font-medium">{t.title}</span>
                    <span className="block text-xs text-muted">
                      {formatDateRangeBR(t.start_date, t.end_date)} ·{" "}
                      {t.past && t.status !== "draft" ? "Realizada" : STATUS_LABELS[t.status]}
                    </span>
                    <Occupancy confirmed={t.confirmed} capacity={t.capacity} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Cover({ path, className }: { path?: string; className: string }) {
  return path ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photoUrl(path)} alt="" className={`${className} shrink-0 rounded-lg object-cover`} />
  ) : (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-lg bg-surface-muted`}
    >
      <CompassIcon className="h-5 w-5 text-faint" />
    </span>
  );
}
