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
    <div className="card p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </dd>
      {detail && <dd className="mt-1 text-sm text-muted">{detail}</dd>}
    </div>
  );
}

export { Badge } from "@/components/badge";
