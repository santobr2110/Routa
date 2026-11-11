/** Número de destaque com rótulo e detalhe opcional. */
export function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
}) {
  return (
    <div className="card min-w-0 p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tracking-tight break-words tabular-nums sm:text-2xl">
        {value}
      </dd>
      {detail && <dd className="mt-1 text-sm text-muted">{detail}</dd>}
    </div>
  );
}

export { Badge } from "@/components/badge";

/** Número com barra de progresso (vagas, pagamentos). */
export function Meter({
  label,
  value,
  pct,
  detail,
  tone = "brand",
}: {
  label: string;
  value: string;
  pct: number;
  detail: string;
  tone?: "brand" | "success";
}) {
  const width = `${Math.round(Math.min(Math.max(pct, 0), 1) * 100)}%`;
  return (
    <div className="card min-w-0 p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
      <dd className="mt-2 h-1.5 rounded-full bg-surface-muted" aria-hidden>
        <div
          className={`h-1.5 rounded-full ${tone === "success" ? "bg-success" : "bg-series-1"}`}
          style={{ width }}
        />
      </dd>
      <dd className="mt-2 text-xs text-muted">{detail}</dd>
    </div>
  );
}
