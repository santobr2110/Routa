import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/badge";
import { CompassIcon } from "@/components/logo";
import { formatBRL, formatShortRangeBR } from "@/lib/format";
import { todayBR } from "@/lib/organizer-stats";
import { STATUS_LABELS } from "@/lib/trips";
import type { TripStatus } from "@/types/database";

/**
 * Tabela de viagens comum ao painel do organizador e ao admin.
 * Largura fixa (table-fixed) e 4–5 colunas que juntam informação, para nunca rolar para o lado:
 * Viagem (capa, título, destino, situação) · Quando · Comboio · Pagamento · atalhos.
 * No celular, a mesma informação vira cartões.
 */
export type TripTableRow = {
  id: string;
  href: string;
  title: string;
  destination: string;
  /** Dono da viagem (só no admin). */
  organizer?: { name: string; suspended?: boolean };
  /** URL da capa; undefined = a tabela não mostra capas. null = sem foto. */
  cover?: string | null;
  start_date: string;
  end_date: string;
  badges: { tone: BadgeTone; text: string }[];
  capacity: number;
  confirmed: number;
  waitlist: number;
  paid: number;
  overdue?: number;
  fixed: boolean;
  /** Valor confirmado em centavos (quando a tela sabe). */
  value_cents?: number;
  paid_cents?: number;
  /** Link para cobrar os pendentes (só o organizador). */
  chargeHref?: string;
  links?: { href: string; label: string; icon: "people" | "chart" }[];
};

/** Situação da viagem em etiquetas, igual no painel e no admin. */
export function tripBadges(t: {
  status: TripStatus;
  past: boolean;
  hidden?: boolean;
  deleted?: "admin" | "organizer" | null;
}): TripTableRow["badges"] {
  const badges: TripTableRow["badges"] = [];
  if (t.past && t.status !== "draft") badges.push({ tone: "muted", text: "Realizada" });
  else
    badges.push({
      tone: t.status === "published" ? "success" : t.status === "draft" ? "warn" : "muted",
      text: STATUS_LABELS[t.status],
    });
  if (t.hidden) badges.push({ tone: "danger", text: "Fora do ar" });
  if (t.deleted) badges.push({ tone: "danger", text: t.deleted === "admin" ? "Excluída (admin)" : "Na lixeira" });
  return badges;
}

export function TripTable({ rows, label }: { rows: TripTableRow[]; label: string }) {
  const today = todayBR();
  const year = today.slice(0, 4);
  const hasLinks = rows.some((r) => r.links?.length);
  return (
    <>
      <div className="card hidden overflow-hidden md:block">
        <table className="w-full table-fixed text-left text-sm">
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr className="border-b border-line bg-surface-muted/50 text-xs text-muted">
              <th scope="col" className="px-4 py-2 font-medium">Viagem</th>
              <th scope="col" className="w-[8rem] px-3 py-2 font-medium">Quando</th>
              <th scope="col" className="w-[10.5rem] px-3 py-2 font-medium">Comboio</th>
              <th scope="col" className="hidden w-[10.5rem] px-3 py-2 font-medium xl:table-cell">Pagamento</th>
              {hasLinks && (
                <th scope="col" className="w-[6rem] px-3 py-2">
                  <span className="sr-only">Atalhos</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-b border-line align-top last:border-0 hover:bg-surface-muted/40">
                <td className="px-4 py-3">
                  <div className="flex min-w-0 gap-3">
                    {t.cover !== undefined && <Cover url={t.cover} className="h-11 w-11" />}
                    <div className="min-w-0 space-y-1">
                      <Link
                        href={t.href}
                        className="line-clamp-2 font-medium break-words hover:text-accent"
                        title={t.title}
                      >
                        {t.title}
                      </Link>
                      <p className="truncate text-xs text-muted" title={subtitle(t)}>
                        {subtitle(t)}
                      </p>
                      <Badges row={t} />
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <p className="font-medium">
                    {formatShortRangeBR(t.start_date, t.end_date, year)}
                  </p>
                  <p className="text-xs whitespace-nowrap text-muted">{when(t, today)}</p>
                </td>
                <td className="px-3 py-3">
                  <Convoy row={t} />
                  {/* Sem a coluna Pagamento (telas médias), o resumo vem aqui. */}
                  <p className="mt-1 text-xs text-muted xl:hidden">
                    {payLine(t)}
                    {!!t.overdue && <span className="text-danger"> · {t.overdue} vencido(s)</span>}
                  </p>
                </td>
                <td className="hidden px-3 py-3 xl:table-cell">
                  <Payment row={t} />
                </td>
                {hasLinks && (
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1">
                      {t.links?.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          title={l.label}
                          aria-label={`${l.label}: ${t.title}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft ring-1 ring-line hover:bg-surface-muted hover:text-accent"
                        >
                          <LinkIcon name={l.icon} />
                        </Link>
                      ))}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid gap-2 md:hidden" aria-label={label}>
        {rows.map((t) => (
          <li key={t.id} className="card space-y-3 p-3">
            <Link href={t.href} className="flex gap-3">
              {t.cover !== undefined && <Cover url={t.cover} className="h-14 w-14" />}
              <span className="min-w-0 flex-1 space-y-1">
                <span className="line-clamp-2 font-medium break-words">{t.title}</span>
                <span className="block truncate text-xs text-muted">
                  {formatShortRangeBR(t.start_date, t.end_date, year)} · {when(t, today)}
                </span>
                <Badges row={t} />
              </span>
            </Link>
            <div className="grid grid-cols-2 gap-3">
              <Convoy row={t} />
              <Payment row={t} />
            </div>
            {(t.links?.length || t.chargeHref) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2 text-sm font-medium">
                {t.links?.map((l) => (
                  <Link key={l.href} href={l.href} className="inline-flex min-h-9 items-center text-accent">
                    {l.label}
                  </Link>
                ))}
                {t.chargeHref && t.paid < t.confirmed && (
                  <Link href={t.chargeHref} className="inline-flex min-h-9 items-center text-accent">
                    Cobrar {t.confirmed - t.paid} →
                  </Link>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function subtitle(t: TripTableRow) {
  return t.organizer ? `${t.destination} · por ${t.organizer.name}` : t.destination;
}

function Badges({ row }: { row: TripTableRow }) {
  const badges = [...row.badges];
  if (row.organizer?.suspended) badges.push({ tone: "danger", text: "Organizador suspenso" });
  if (badges.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {badges.map((b) => (
        <Badge key={b.text} tone={b.tone}>
          {b.text}
        </Badge>
      ))}
    </span>
  );
}

function when(t: TripTableRow, today: string) {
  if (t.end_date < today) return "já aconteceu";
  if (t.start_date <= today) return "na estrada";
  const days = Math.round((Date.parse(t.start_date) - Date.parse(today)) / 86_400_000);
  return days === 1 ? "amanhã" : `em ${days} dias`;
}

function Convoy({ row: t }: { row: TripTableRow }) {
  const pct = t.capacity > 0 ? Math.min((t.confirmed / t.capacity) * 100, 100) : 0;
  const free = Math.max(t.capacity - t.confirmed, 0);
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-sm whitespace-nowrap">
        <strong className="font-semibold tabular-nums">{t.confirmed}</strong>
        <span className="text-muted tabular-nums">/{t.capacity} motos</span>
      </p>
      <Bar pct={pct} className="bg-series-1" label={`${Math.round(pct)}% das vagas`} />
      <p className="truncate text-xs text-muted">
        {free > 0 ? `${free} livre${free === 1 ? "" : "s"}` : "lotada"}
        {t.waitlist > 0 && ` · ${t.waitlist} na fila`}
      </p>
    </div>
  );
}

function payLine(t: TripTableRow) {
  if (t.confirmed === 0) return "ninguém para pagar";
  return `${t.paid}/${t.confirmed} pagos`;
}

function Payment({ row: t }: { row: TripTableRow }) {
  const pct = t.confirmed > 0 ? (t.paid / t.confirmed) * 100 : 0;
  const pending = t.value_cents !== undefined && t.paid_cents !== undefined ? t.value_cents - t.paid_cents : null;
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-sm whitespace-nowrap">
        <strong className="font-semibold tabular-nums">{t.paid}</strong>
        <span className="text-muted tabular-nums">/{t.confirmed} pagos</span>
      </p>
      <Bar pct={pct} className="bg-success" label={`${Math.round(pct)}% pagos`} />
      <p className="truncate text-xs text-muted">
        {!t.fixed ? (
          "rateio"
        ) : t.overdue ? (
          <span className="text-danger">{t.overdue} com prazo vencido</span>
        ) : pending !== null && pending > 0 && t.chargeHref ? (
          <Link href={t.chargeHref} className="font-medium text-accent hover:underline">
            cobrar {formatBRL(pending)}
          </Link>
        ) : pending !== null && pending > 0 ? (
          `falta ${formatBRL(pending)}`
        ) : t.value_cents !== undefined && t.value_cents > 0 ? (
          `${formatBRL(t.value_cents)} no total`
        ) : t.confirmed > 0 && t.paid === t.confirmed ? (
          "tudo pago ✓"
        ) : (
          "valor fixo"
        )}
      </p>
    </div>
  );
}

function Bar({ pct, className, label }: { pct: number; className: string; label: string }) {
  return (
    <div className="h-1.5 rounded-full bg-surface-muted" role="img" aria-label={label}>
      <div className={`h-1.5 rounded-full ${className}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Cover({ url, className }: { url: string | null; className: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={`${className} shrink-0 rounded-lg object-cover`} />
  ) : (
    <span className={`${className} flex shrink-0 items-center justify-center rounded-lg bg-surface-muted`}>
      <CompassIcon className="h-5 w-5 text-faint" />
    </span>
  );
}

function LinkIcon({ name }: { name: "people" | "chart" }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {name === "people" ? (
        <>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" />
          <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.2 2.5 3.5 5.2" />
        </>
      ) : (
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      )}
    </svg>
  );
}
