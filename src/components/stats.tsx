import Link from "next/link";
import { formatBRL } from "@/lib/format";
import { PERIODS, type PeriodKey } from "@/lib/periods";

const nf = new Intl.NumberFormat("pt-BR");

/** Botões de período (7/30/90 dias, 12 meses) que trocam o ?periodo= da URL. */
export function PeriodPicker({ current, href }: { current: PeriodKey; href: (key: PeriodKey) => string }) {
  return (
    <nav className="inline-flex rounded-lg border border-line bg-surface p-0.5" aria-label="Período">
      {(Object.keys(PERIODS) as PeriodKey[]).map((key) => (
        <Link
          key={key}
          href={href(key)}
          aria-current={key === current ? "page" : undefined}
          className="inline-flex min-h-9 items-center rounded-md px-3 text-sm text-ink-soft aria-[current=page]:bg-surface-muted aria-[current=page]:font-medium aria-[current=page]:text-ink"
        >
          {PERIODS[key].label}
        </Link>
      ))}
    </nav>
  );
}

/** Número do período com a variação em relação ao período anterior. */
export function Kpi({
  label,
  value,
  previous,
  money = false,
  lowerIsBetter = false,
}: {
  label: string;
  value: number;
  previous?: number;
  money?: boolean;
  lowerIsBetter?: boolean;
}) {
  let note: React.ReactNode = null;
  if (previous !== undefined) {
    const diff = value - previous;
    const change = previous > 0 ? Math.round((diff / previous) * 100) : null;
    const good = lowerIsBetter ? diff < 0 : diff > 0;
    const tone = diff === 0 ? "text-muted" : good ? "text-success" : "text-danger";
    const text =
      diff === 0
        ? "igual ao anterior"
        : change === null
          ? "novo no período"
          : `${diff > 0 ? "↑" : "↓"} ${Math.abs(change)}% vs. anterior`;
    note = <dd className={`mt-0.5 text-xs ${tone}`}>{text}</dd>;
  }
  return (
    <div className="card p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
        {money ? formatBRL(value) : nf.format(value)}
      </dd>
      {note}
    </div>
  );
}

/** Número de agora, mais discreto que o Kpi. */
export function Snapshot({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      {hint && <dd className="text-xs text-muted">{hint}</dd>}
    </div>
  );
}

/** Barra fina de ocupação com "confirmados/vagas". */
export function Occupancy({ confirmed, capacity }: { confirmed: number; capacity: number }) {
  const pct = capacity > 0 ? Math.min((confirmed / capacity) * 100, 100) : 0;
  return (
    <div className="flex min-w-28 items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-surface-muted">
        <div className="h-1.5 rounded-full bg-series-1" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted tabular-nums">
        {confirmed}/{capacity}
      </span>
    </div>
  );
}
